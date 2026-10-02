import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { makeAuthMock, makeUserProfile } from '@/test/testUtils';

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: vi.fn(),
}));

vi.mock('@/components/VerifyEmail', () => ({
    default: () => <div data-testid="verify-email">Verify your email</div>,
}));

import { useAuth } from '@/contexts/AuthContext';

const mockUseAuth = vi.mocked(useAuth);

function renderGate(authOverrides: Parameters<typeof makeAuthMock>[0] = {}) {
    mockUseAuth.mockReturnValue(makeAuthMock(authOverrides) as ReturnType<typeof useAuth>);

    return render(
        <MemoryRouter initialEntries={['/']}>
            <Routes>
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <div data-testid="protected-home">Home</div>
                        </ProtectedRoute>
                    }
                />
                <Route path="/auth" element={<div data-testid="auth-page">Auth</div>} />
            </Routes>
        </MemoryRouter>
    );
}

describe('ProtectedRoute auth gate', () => {
    beforeEach(() => {
        mockUseAuth.mockReset();
    });

    it('shows a loading state while auth is resolving', () => {
        renderGate({ user: null, isLoading: true });
        expect(screen.getByText(/Loading/i)).toBeInTheDocument();
        expect(screen.queryByTestId('protected-home')).not.toBeInTheDocument();
        expect(screen.queryByTestId('auth-page')).not.toBeInTheDocument();
    });

    it('redirects unauthenticated users to /auth', () => {
        renderGate({ user: null, isLoading: false, firebaseUser: null });
        expect(screen.getByTestId('auth-page')).toBeInTheDocument();
        expect(screen.queryByTestId('protected-home')).not.toBeInTheDocument();
    });

    it('blocks email/password users who still need verification', () => {
        renderGate({
            user: makeUserProfile(),
            isLoading: false,
            needsEmailVerification: true,
            firebaseUser: { email: 'tester@example.com', emailVerified: false },
        });
        expect(screen.getByTestId('verify-email')).toBeInTheDocument();
        expect(screen.queryByTestId('protected-home')).not.toBeInTheDocument();
    });

    it('renders children when the user is authenticated and verified', () => {
        renderGate({
            user: makeUserProfile({ tier: 'pro' }),
            isLoading: false,
            needsEmailVerification: false,
        });
        expect(screen.getByTestId('protected-home')).toBeInTheDocument();
        expect(screen.queryByTestId('auth-page')).not.toBeInTheDocument();
    });
});
