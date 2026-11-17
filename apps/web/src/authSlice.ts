import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { UserDTO } from '@lumen/shared';

export interface AuthState {
  user: UserDTO | null;
  token: string | null;
  ready: boolean;
}

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, token: null, ready: false } as AuthState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: UserDTO; token: string }>) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.ready = true;
    },
    setUser(state, action: PayloadAction<UserDTO>) {
      state.user = action.payload;
    },
    clearCredentials(state) {
      state.user = null;
      state.token = null;
      state.ready = true;
    },
    markReady(state) {
      state.ready = true;
    },
  },
});

export const { setCredentials, setUser, clearCredentials, markReady } = authSlice.actions;
export default authSlice.reducer;
