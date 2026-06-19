import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * True when running inside Expo Go, where custom native modules (react-native-maps,
 * Google sign-in, etc.) are not available. Use it to render graceful fallbacks so
 * the app doesn't crash before a development build is made.
 */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
