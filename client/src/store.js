import { configureStore, createSlice } from "@reduxjs/toolkit";

const saved = (() => {
  try { return JSON.parse(localStorage.getItem("td-session") || "null"); } catch { return null; }
})();

const session = createSlice({
  name: "session",
  initialState: saved || { token: null, user: null, deviceId: localStorage.getItem("td-device") || "" },
  reducers: {
    setSession(state, action) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      localStorage.setItem("td-session", JSON.stringify(state));
    },
    setDevice(state, action) {
      state.deviceId = action.payload;
      localStorage.setItem("td-device", action.payload);
    },
    logout(state) {
      state.token = null;
      state.user = null;
      localStorage.removeItem("td-session");
    },
  },
});

const exam = createSlice({
  name: "exam",
  initialState: { attempt: null, index: 0, answers: {}, flags: {}, startedAt: null },
  reducers: {
    loadAttempt(state, action) {
      state.attempt = action.payload;
      state.index = 0;
      state.answers = {};
      state.flags = {};
      state.startedAt = Date.now();
      localStorage.setItem("td-offline-attempt", JSON.stringify(action.payload));
    },
    jump(state, action) { state.index = action.payload; },
    choose(state, action) {
      state.answers[action.payload.id] = action.payload.choice;
    },
    toggleFlag(state, action) {
      state.flags[action.payload] = !state.flags[action.payload];
    },
    clearChoice(state, action) { delete state.answers[action.payload]; },
    clearExam(state) {
      state.attempt = null;
      localStorage.removeItem("td-offline-attempt");
    },
  },
});

export const { setSession, setDevice, logout } = session.actions;
export const { loadAttempt, jump, choose, toggleFlag, clearChoice, clearExam } = exam.actions;

export const store = configureStore({
  reducer: { session: session.reducer, exam: exam.reducer },
});
