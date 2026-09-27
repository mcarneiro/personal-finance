import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import appReducer from '../store/appSlice';
import { GoogleAuthProvider, useGoogleAuth } from './GoogleAuthContext';

// The client ID is normally baked in from the environment; here it is mutable so
// both the configured and unconfigured builds can be exercised.
const config = vi.hoisted(() => ({ CLIENT_ID: '' }));
const { loginMock, useGoogleLoginMock } = vi.hoisted(() => {
  const loginMock = vi.fn();
  return { loginMock, useGoogleLoginMock: vi.fn(() => loginMock) };
});

vi.mock('../config/google', () => ({ GOOGLE_CONFIG: config }));
vi.mock('@react-oauth/google', () => ({ useGoogleLogin: useGoogleLoginMock }));

function Probe() {
  const { isSignedIn, signIn } = useGoogleAuth();
  return (
    <button type="button" onClick={signIn}>
      signed-in: {String(isSignedIn)}
    </button>
  );
}

function renderProvider() {
  const store = configureStore({ reducer: { app: appReducer } });
  render(
    <Provider store={store}>
      <GoogleAuthProvider>
        <Probe />
      </GoogleAuthProvider>
    </Provider>
  );
  return store;
}

describe('GoogleAuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an unconfigured build without initializing the Google login client', () => {
    // Given no OAuth client ID is configured
    config.CLIENT_ID = '';

    // When the provider mounts
    const store = renderProvider();

    // Then onboarding can render instead of the app crashing blank, and startup proceeds
    expect(screen.getByText('signed-in: false')).toBeInTheDocument();
    expect(useGoogleLoginMock).not.toHaveBeenCalled();
    expect(store.getState().app.authInitialized).toBe(true);
  });

  it('initializes the login client and wires signIn when a client ID exists', async () => {
    // Given an OAuth client ID is configured
    config.CLIENT_ID = 'test-client-id';

    // When the provider mounts and the user signs in
    renderProvider();
    await userEvent.click(screen.getByRole('button', { name: /signed-in/ }));

    // Then the Google login client is created and invoked
    expect(useGoogleLoginMock).toHaveBeenCalledTimes(1);
    expect(loginMock).toHaveBeenCalledTimes(1);
  });
});
