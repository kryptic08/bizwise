import { Tabs } from "expo-router";
import { List, Plus, ShoppingCart, User } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";

function CustomTabBar({ state, descriptors, navigation, colors }: any) {
  // Insert a fake route for the plus button at index 2
  const routesWithPlus = [
    state.routes[0], // Home
    state.routes[1], // Transactions
    { key: "plus", name: "plus" }, // Plus button (fake route)
    state.routes[2], // Counter
    state.routes[3], // Profile
  ];

  return (
    <View style={[styles.tabBar, { backgroundColor: "#c8def6" }]}>
      {routesWithPlus.map((route: any, index: number) => {
        if (index === 2) {
          // Middle position - Plus button
          return (
            <View key="plus" style={[styles.tabItem, styles.plusButton]}>
              <TouchableOpacity
                style={styles.plusButtonInner}
                onPress={() => {
                  navigation.navigate("add-expense");
                }}
              >
                <Plus size={24} color="white" />
              </TouchableOpacity>
            </View>
          );
        }

        // Get the actual route index (accounting for the fake plus button)
        const actualRouteIndex = index > 2 ? index - 1 : index;
        const actualRoute = state.routes[actualRouteIndex];
        const { options } = descriptors[actualRoute.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : actualRoute.name;
        const isFocused = state.index === actualRouteIndex;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: actualRoute.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(actualRoute.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: "tabLongPress",
            target: actualRoute.key,
          });
        };

        return (
          <TouchableOpacity
            key={actualRoute.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabItem}
          >
            <View
              style={[
                styles.iconContainer,
                isFocused && styles.activeIconContainer,
              ]}
            >
              {options.tabBarIcon &&
                options.tabBarIcon({
                  color: isFocused ? "#ffffff" : colors.tabIconDefault,
                })}
            </View>
            {label && (
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? colors.tint : colors.tabIconDefault },
                ]}
              >
                {label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  const colors = Colors.light;

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} colors={colors} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color }) => <List size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="counter"
        options={{
          title: "Counter",
          tabBarIcon: ({ color }) => <ShoppingCart size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add-expense"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    height: 70,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginHorizontal: 0,
    marginBottom: 0,
    paddingBottom: 8,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 0,
    borderColor: "transparent",
  },
  tabItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: 40,
    height: 40,
  },
  activeIconContainer: {
    backgroundColor: "#3b6ea5",
    borderRadius: 15,
  },
  plusButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  plusButtonInner: {
    width: 65,
    height: 65,
    borderRadius: 25,
    backgroundColor: "#3b6ea5",
    justifyContent: "center",
    alignItems: "center",
    marginTop: -28,
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 2,
  },
});
