import { Toast } from '@capacitor/toast';

export const showToast = async (text: string, duration: 'short' | 'long' = 'short') => {
  try {
    await Toast.show({ text, duration });
  } catch {
    console.log('[Toast]', text);
  }
};
