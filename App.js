// App.js - Root level, bypasses Expo Router
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Platform,
  BackHandler,
  StatusBar,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const APP_URL = 'https://ledger1x.web.app';

function WebViewScreen() {
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (canGoBack && webViewRef.current) {
            webViewRef.current.goBack();
            return true;
          }
          return false;
        }
      );
      return () => backHandler.remove();
    }
  }, [canGoBack]);

  const injectedJavaScript = `
    (function() {
      console.log('[Mobile] Starting...');
      
      // Viewport
      let meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
      }
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

      // Intercept fetch
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        const [url, options] = args;
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'api-call',
          url: url.toString(),
          method: options?.method || 'GET',
          hasAuth: !!(options?.headers?.Authorization || options?.headers?.authorization)
        }));
        
        return originalFetch.apply(this, args)
          .then(response => {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'api-response',
              url: url.toString(),
              status: response.status,
              ok: response.ok
            }));
            return response;
          })
          .catch(error => {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'api-error',
              url: url.toString(),
              error: error.message
            }));
            throw error;
          });
      };

      // Monitor localStorage
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = function(key, value) {
        originalSetItem.apply(this, arguments);
        if (key === 'token') {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'token-saved',
            tokenLength: value ? value.length : 0
          }));
        }
      };

      // Check auth
      function checkAuth() {
        setTimeout(() => {
          const token = localStorage.getItem('token');
          const path = window.location.pathname;
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'auth-status',
            hasToken: !!token,
            path: path,
            tokenLength: token ? token.length : 0
          }));
        }, 1000);
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAuth);
      } else {
        checkAuth();
      }

      console.log('[Mobile] Initialized');
    })();
    true;
  `;

  const onMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch(data.type) {
        case 'api-call':
          console.log('[Native] 🔵', data.method, data.url);
          console.log('[Native]   Auth:', data.hasAuth ? '✓' : '✗');
          break;
          
        case 'api-response':
          console.log('[Native] 🟢', data.status, data.url);
          if (!data.ok) {
            console.error('[Native] ⚠️ Failed:', data.status);
          }
          break;
          
        case 'api-error':
          console.error('[Native] 🔴 Error:', data.error);
          console.error('[Native]   URL:', data.url);
          break;
        
        case 'token-saved':
          console.log('[Native] ✅ Token saved! Length:', data.tokenLength);
          break;
          
        case 'auth-status':
          console.log('[Native] 📊 Auth:', data.hasToken ? 'YES' : 'NO', '| Path:', data.path);
          break;
      }
    } catch (err) {
      // Ignore
    }
  };

  const onError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('[Native] ❌ WebView error:', nativeEvent);
    
    Alert.alert(
      'Error',
      'Failed to load app',
      [{ text: 'Retry', onPress: () => webViewRef.current?.reload() }]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <WebView
        ref={webViewRef}
        source={{ uri: APP_URL }}
        
        javaScriptEnabled={true}
        injectedJavaScript={injectedJavaScript}
        onMessage={onMessage}
        
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        
        scalesPageToFit={true}
        
        onLoadStart={() => {
          console.log('[Native] ⏳ Loading...');
          setLoading(true);
        }}
        onLoadEnd={() => {
          console.log('[Native] ✅ Loaded');
          setLoading(false);
        }}
        onNavigationStateChange={(navState) => {
          console.log('[Native] 📍', navState.url);
          setCanGoBack(navState.canGoBack);
        }}
        onError={onError}
        
        style={styles.webview}
      />

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <WebViewScreen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
});