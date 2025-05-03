// App.js

// Must come first, before any other imports that might use `uuid`
import 'react-native-get-random-values';

import { enableScreens } from 'react-native-screens';
enableScreens();

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PiListScreen      from './src/screens/PiListScreen.container';
import AddPiScreen       from './src/screens/AddPiScreen.container';
import PiDashboardScreen from './src/screens/PiDashboardScreen.container';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="PiList">
        <Stack.Screen
          name="PiList"
          component={PiListScreen}
          options={{ title: 'My Pis' }}
        />

        <Stack.Screen
          name="AddPi"
          component={AddPiScreen}
          options={{ title: 'Add a Pi' }}
        />

        <Stack.Screen
          name="PiDashboard"
          component={PiDashboardScreen}
          options={{ title: 'Pi Wifi Networks' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
