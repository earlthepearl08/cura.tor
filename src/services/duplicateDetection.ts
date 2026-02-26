import { Contact } from '@/types/contact';

export interface DuplicateResult {
    isDuplicate: boolean;
    matchType: 'exact' | 'similar' | 'none';
    matchedContact: Contact | null;
    matchScore: number; // 0-100
    matchReasons: string[];
}

/**
 * Normalize string for comparison
 */
function normalize(str: string): string {
    return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Normalize phone number (remove all non-digits)
 */
function normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
}

/**
 * Calculate similarity between two strings (optimized Levenshtein-based)
 */
function stringSimilarity(str1: string, str2: string): number {
    const s1 = normalize(str1);
    const s2 = normalize(str2);

    if (s1 === s2) return 100;
    if (s1.length === 0 || s2.length === 0) return 0;

    // Early exit: if length difference is too large, strings can't be similar
    const lenDiff = Math.abs(s1.length - s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    if (lenDiff > maxLen * 0.5) return Math.round((1 - lenDiff / maxLen) * 100);

    // Simple containment check (fast path)
    if (s1.includes(s2) || s2.includes(s1)) {
        return 80;
    }

    // For very long strings, use a simpler comparison to avoid O(n*m) overhead
    if (maxLen > 100) {
        // Use word overlap for long strings
        const words1 = new Set(s1.split(' '));
        const words2 = new Set(s2.split(' '));
        const overlap = [...words1].filter(w => words2.has(w)).length;
        return Math.round((overlap / Math.max(words1.size, words2.size)) * 100);
    }

    // Calculate Levenshtein distance with single-row optimization
    let prev = Array.from({ length: s2.length + 1 }, (_, i) => i);
    let curr = new Array(s2.length + 1);

    for (let i = 1; i <= s1.length; i++) {
        curr[0] = i;
        for (let j = 1; j <= s2.length; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        }
        [prev, curr] = [curr, prev]; // Swap arrays
    }

    const distance = prev[s2.length];
    const similarity = ((maxLen - distance) / maxLen) * 100;

    return Math.round(similarity);
}

/**
 * Check if two contacts are duplicates
 */
export function checkDuplicate(
    newContact: Partial<Contact>,
    existingContacts: Contact[]
): DuplicateResult {
    const result: DuplicateResult = {
        isDuplicate: false,
        matchType: 'none',
        matchedContact: null,
        matchScore: 0,
        matchReasons: []
    };

    for (const existing of existingContacts) {
        const reasons: string[] = [];
        let score = 0;

        // Check email match (strongest indicator)
        const newEmails = newContact.email || [];
        const existingEmails = existing.email || [];
        const emailMatch = newEmails.some(newEmail =>
            existingEmails.some(existingEmail =>
                normalize(newEmail) === normalize(existingEmail)
            )
        );
        if (emailMatch) {
            score += 50;
            reasons.push('Same email address');
        }

        // Check phone match (strong indicator)
        const newPhones = newContact.phone || [];
        const existingPhones = existing.phone || [];
        const phoneMatch = newPhones.some(newPhone =>
            existingPhones.some(existingPhone =>
                normalizePhone(newPhone) === normalizePhone(existingPhone)
            )
        );
        if (phoneMatch) {
            score += 40;
            reasons.push('Same phone number');
        }

        // Check name similarity
        if (newContact.name && existing.name) {
            const nameSimilarity = stringSimilarity(newContact.name, existing.name);
            if (nameSimilarity >= 90) {
                score += 45;
                reasons.push('Same name');
            } else if (nameSimilarity >= 70) {
                score += 20;
                reasons.push('Similar name');
            }
        }

        // Check company match
        if (newContact.company && existing.company) {
            const companySimilarity = stringSimilarity(newContact.company, existing.company);
            if (companySimilarity >= 80) {
                score += 10;
                reasons.push('Same company');
            }
        }

        // Determine match type
        if (score > result.matchScore) {
            result.matchScore = score;
            result.matchedContact = existing;
            result.matchReasons = reasons;

            if (score >= 80) {
                result.isDuplicate = true;
                result.matchType = 'exact';
                // Early termination: found exact match, no need to continue
                return result;
            } else if (score >= 50) {
                result.isDuplicate = true;
                result.matchType = 'similar';
            }
        }
    }

    return result;
}

/**
 * Find all potential duplicates for a contact
 */
export function findAllDuplicates(
    contact: Partial<Contact>,
    existingContacts: Contact[],
    threshold: number = 40
): Array<{ contact: Contact; score: number; reasons: string[] }> {
    const duplicates: Array<{ contact: Contact; score: number; reasons: string[] }> = [];

    for (const existing of existingContacts) {
        // Skip self
        if (contact.id && contact.id === existing.id) continue;

        const result = checkDuplicate(contact, [existing]);
        if (result.matchScore >= threshold && result.matchedContact) {
            duplicates.push({
                contact: result.matchedContact,
                score: result.matchScore,
                reasons: result.matchReasons
            });
        }
    }

    // Sort by score descending
    return duplicates.sort((a, b) => b.score - a.score);
}
