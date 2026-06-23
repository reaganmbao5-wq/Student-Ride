import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { PushNotifications } from '@capacitor/push-notifications';
import { toast } from 'sonner';

export const PermissionsService = {
  async requestLocationPermission() {
    if (!Capacitor.isNativePlatform()) return true;
    
    try {
      const permissions = await Geolocation.checkPermissions();
      if (permissions.location === 'granted') return true;
      
      const request = await Geolocation.requestPermissions();
      if (request.location !== 'granted') {
        toast.error('Location permission is required for MuluRides.');
        return false;
      }
      return true;
    } catch (e) {
      console.warn("Geolocation permissions error:", e);
      return false;
    }
  },

  async requestCameraPermission() {
    if (!Capacitor.isNativePlatform()) return true;
    
    try {
      const permissions = await Camera.checkPermissions();
      if (permissions.camera === 'granted' && permissions.photos === 'granted') return true;
      
      const request = await Camera.requestPermissions();
      if (request.camera !== 'granted' && request.photos !== 'granted') {
        toast.error('Camera or Gallery access is required to upload documents.');
        return false;
      }
      return true;
    } catch (e) {
      console.warn("Camera permissions error:", e);
      return false;
    }
  },

  async requestPushPermission() {
    if (!Capacitor.isNativePlatform()) return true;
    
    try {
      const permissions = await PushNotifications.checkPermissions();
      if (permissions.receive === 'granted') return true;

      const request = await PushNotifications.requestPermissions();
      if (request.receive !== 'granted') {
        console.warn('Push notification permission denied.');
        return false;
      }
      return true;
    } catch (e) {
      console.warn("Push permissions error:", e);
      return false;
    }
  }
};
