import * as _ from 'lodash';
import * as rc from 'rc-yaml';
import * as fs from 'fs';
import * as path from 'path';
import * as gmail from 'gmail-send';

interface Config {
  gmail: {
    user: string;
    password: string;
    subject: string;
  };
  people: { name: string; email: string }[];
  avoid: [string, string][];
  dryRun: boolean;
}

const config: Config = rc(require('../package.json').name, { dryRun: true });

const send = gmail({
  user: config.gmail.user,
  pass: config.gmail.password
});

const subject = _.template(config.gmail.subject);
const emailHtml = _.template(
  fs.readFileSync(path.resolve(__dirname, '..', 'template.html'), 'utf8')
);

class Person {
  constructor(public name?: string, public email?: string) {}

  equals(other: Person) {
    return other instanceof Person && other.name === this.name;
  }

  toString() {
    return this.name;
  }
}

class Pairing {
  constructor(public a: string, public b: string) {}

  toString() {
    return `${this.a}→${this.b}`;
  }
}

type PickResult = [Pairing, Pairing[]];

function generatePairs(people: Person[], avoidList: Pairing[]) {
  let avoid: _.Dictionary<Pairing> = _.keyBy(avoidList, pair =>
    pair.toString()
  );
  let pairs: Pairing[] = [];

  for (let i = 0; i < people.length; i++) {
    for (let j = 0; j < people.length; j++) {
      if (i !== j) {
        let pair = new Pairing(people[i].name, people[j].name);

        if (!avoid[pair.toString()]) {
          pairs.push(pair);
        }
      }
    }
  }

  return pairs;
}

function pickPair(pairs: Pairing[]): PickResult {
  let n = Math.floor(Math.random() * pairs.length);
  let pair = pairs[n];

  return [pair, pairs.filter(p => p.a !== pair.a && p.b !== pair.b)];
}

function sendMessage(a: Person, b: Person) {
  const data = { name: a.name, recipient: b.name };

  return new Promise((resolve, reject) =>
    send(
      {
        to: a.email,
        subject: subject(data),
        html: emailHtml(data)
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    )
  );
}

let people = config.people.map(p => new Person(p.name, p.email));

let avoid = _.flatMap(config.avoid, a => [
  new Pairing(a[0], a[1]),
  new Pairing(a[1], a[0])
]);

let allPairs = generatePairs(people, avoid);

let pair;
let pairings: Pairing[] = [];
let attempt = 0;

while (pairings.length < people.length) {
  let currentPairs = allPairs;
  pairings = [];
  console.log(`attempt ${attempt++}`);

  while (currentPairs.length) {
    [pair, currentPairs] = pickPair(currentPairs);
    pairings.push(pair);
  }
}

if (!config.dryRun) {
  let map = _.keyBy(people, p => p.name);

  Promise.all(_.map(pairings, p => sendMessage(map[p.a], map[p.b]))).then(
    result => {
      console.log('Messages sent!');
    },
    err => {
      console.error(err);
    }
  );
} else {
  pairings.forEach(pair => console.log(pair.toString()));
}
