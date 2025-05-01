// App.js

// Must come first, before any other imports that might use `uuid`
import 'react-native-get-random-values';

import { enableScreens } from 'react-native-screens';
enableScreens();

import React from 'react';
import { TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';

import PiListScreen      from './src/screens/PiListScreen.container';
import AddPiScreen       from './src/screens/AddPiScreen.container';
import PiDashboardScreen from './src/screens/PiDashboardScreen.container';
import PiInfoScreen      from './src/screens/PiInfoScreen.container';

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
          options={({ route, navigation }) => ({
            title: route.params.hostname,
            headerRight: () => (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('PiInfo', {
                    id:        route.params.id,
                    hostname:  route.params.hostname,
                    host:      route.params.host,
                  })
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="info-outline" size={24} color="#0077ff" />
              </TouchableOpacity>
            ),
            headerRightContainerStyle: {
              paddingHorizontal: 16,
              paddingVertical: 8,
            },
          })}
        />

        <Stack.Screen
          name="PiInfo"
          component={PiInfoScreen}
          options={{ title: 'Pi Info' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
