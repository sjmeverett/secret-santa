import * as _ from 'lodash';
import * as twilio from 'twilio';


interface Config {
  twilio: {
    accountSid: string,
    authToken: string,
    number: string
  };

  people: {name: string, phone: string}[];
  avoid: [string, string][];
  sendTexts: boolean;
}

const config: Config = require('rc-yaml')(require('../package.json').name, {
  sendTexts: false
});

const client = new twilio.RestClient(config.twilio.accountSid, config.twilio.authToken);

class Person {
  constructor(public name?: string, public phone?: string) {
  }

  equals(other: Person) {
    return other instanceof Person && other.name === this.name;
  }

  toString() {
    return this.name;
  }
}

class Pairing {
  a: string;
  b: string;

  constructor(a: string, b: string) {
    if (a < b) {
      this.a = a;
      this.b = b;

    } else {
      this.a = b;
      this.b = a;
    }
  }

  equals(other: Pairing) {
    return this.a === other.a && this.b === other.b;
  }

  toString() {
    return `${this.a}×${this.b}`;
  }

  has(name: string) {
    return this.a === name || this.b === name;
  }
}

type PickResult = [Pairing, Pairing[]];


function generatePairs(people: Person[], avoidList: Pairing[]) {
  let avoid: _.Dictionary<Pairing> = _.keyBy(avoidList, (pair) => pair.toString());
  let pairs: Pairing[] = [];

  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      let pair = new Pairing(people[i].name, people[j].name);

      if (!avoid[pair.toString()]) {
        pairs.push(pair);
      }
    }
  }

  return pairs;
}


function pickPair(pairs: Pairing[]): PickResult {
  let n = Math.floor(Math.random() * pairs.length);
  let pair = pairs[n];

  return [pair, pairs.filter((p) => !(p.has(pair.a) || p.has(pair.b)))]; 
}


function sendMessage(a: Person, b: Person) {
  return client.sendMessage({
    from: config.twilio.number,
    to: a.phone,
    body: `SECRET SANTA: Hi ${a.name}, your pairing is ${b.name}.  Ho, ho, ho`
  });
}


let people = config.people.map((p) => new Person(p.name, p.phone));

let allPairs = generatePairs(
  people,
  config.avoid.map((a) => new Pairing(a[0], a[1]))
);

let pair;
let pairings: Pairing[] = [];

while (allPairs.length) {
  [pair, allPairs] = pickPair(allPairs);
  pairings.push(pair);

  if (!config.sendTexts) {
    console.log(pair.toString());
  }
}

if (config.sendTexts) {
  let map = _.keyBy(people, (p) => p.name);

  Promise.all(
    _.flatMap(pairings, (p) => [
      sendMessage(map[p.a], map[p.b]),
      sendMessage(map[p.b], map[p.a])
    ])
  ).then(
    (result) => {
      console.log('Messages sent!');
    },
    (err) => {
      console.error(err);
    }
  );
}


 