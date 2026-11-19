import { describe, it, expect } from 'vitest';
import { exportService, splitPersonName } from '@/services/export';
import { makeContact } from '@/test/testUtils';

describe('splitPersonName (PH card conventions)', () => {
    it('keeps credentials after a comma out of the family name', () => {
        expect(splitPersonName('Engr. Maria Santos, REE, PEE')).toEqual({
            prefix: 'Engr.', given: 'Maria', family: 'Santos', suffix: 'REE, PEE',
        });
    });
    it('handles Jr./III and multi-word given names', () => {
        expect(splitPersonName('Juan Miguel dela Cruz Jr.')).toMatchObject({ given: 'Juan Miguel dela', family: 'Cruz', suffix: 'Jr.' });
        expect(splitPersonName('Atty. Jose Rizal III')).toMatchObject({ prefix: 'Atty.', given: 'Jose', family: 'Rizal', suffix: 'III' });
    });
    it('single-token names stay as given name', () => {
        expect(splitPersonName('Madonna')).toEqual({ prefix: '', given: 'Madonna', family: '', suffix: '' });
    });
});

describe('vCard escaping', () => {
    it('escapes commas and semicolons in values', () => {
        const v = exportService.contactToVCard(makeContact({
            name: 'Engr. Maria Santos, REE', company: 'Kinmo PW, Inc.', position: 'Sales; Marketing', phone: [], email: [],
        }));
        expect(v).toContain('N:Santos;Maria;;Engr.;REE\r\n');
        expect(v).toContain('ORG:Kinmo PW\\, Inc.\r\n');
        expect(v).toContain('TITLE:Sales\\; Marketing\r\n');
    });
    it('company-only contacts get an empty N, not the company split as a person', () => {
        const v = exportService.contactToVCard(makeContact({ name: '', company: 'Acme Trading Corp', phone: [], email: [] }));
        expect(v).toContain('N:;;;;\r\n');
        expect(v).toContain('FN:Acme Trading Corp\r\n');
    });
});
