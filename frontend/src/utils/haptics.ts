import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const hapticLight = async () => { try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {} };
export const hapticMedium = async () => { try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {} };
export const hapticSuccess = async () => { try { await Haptics.notification({ type: NotificationType.Success }); } catch {} };
