#!/usr/bin/env node
/** Tiny scorer checks — primary fields name/company/phone/email. */
import { scoreContact, scoreLogSheet, aggregateCardScores } from '../lib/score.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const expected = {
  name: 'Engr. Maria Santos, REE, PEE',
  company: 'KINMO PW Corporation',
  position: 'Senior Sales Manager',
  phone: ['+63 917 555 1234', '8703-5284'],
  email: ['maria.santos@kinmopw.com'],
  address: 'Taguig',
  notes: 'www.kinmopw.com',
};

const perfect = scoreContact(expected, { ...expected, phone: ['09175551234', '87035284'] });
assert(perfect.primaryAccuracy === 1, `expected perfect primary, got ${perfect.primaryAccuracy}`);
assert(perfect.fields.phone.match, 'phone suffix match should pass');

const badCompany = scoreContact(expected, { ...expected, company: 'Corporation' });
assert(badCompany.primaryAccuracy === 0.75, `bad company → 3/4 primary, got ${badCompany.primaryAccuracy}`);
assert(!badCompany.fields.company.match, 'company mismatch');

const badPhone = scoreContact(expected, {
  ...expected,
  phone: ['+63 917 555 1234'], // missing second number → F1 < 1
});
assert(!badPhone.fields.phone.match, 'partial phone set should fail primary phone match');
assert(badPhone.primaryHits === 3, `expected 3 primary hits, got ${badPhone.primaryHits}`);

const sheet = scoreLogSheet(
  [
    { name: 'A', company: 'Co', position: '', phone: ['1'], email: ['a@x.com'], address: '', notes: '' },
    { name: 'B', company: 'Co2', position: '', phone: ['2'], email: [], address: '', notes: '' },
  ],
  [
    { name: 'B', company: 'Co2', position: '', phone: ['2'], email: [], address: '', notes: '' },
    { name: 'A', company: 'Co', position: '', phone: ['1'], email: ['a@x.com'], address: '', notes: '' },
  ]
);
assert(sheet.avgPrimaryAccuracy === 1, 'row order should not matter');

const agg = aggregateCardScores([perfect, badCompany]);
assert(agg.primaryPerField.name === 1, 'name field aggregate');
assert(agg.primaryPerField.company === 0.5, 'company field aggregate');

console.log('score-test: ok');
