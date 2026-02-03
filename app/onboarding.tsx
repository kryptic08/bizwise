import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

const COLORS = {
  primaryBlue: "#3b6ea5",
  lightBlueBg: "#f0f6fc",
  circleBg: "#c8def6",
  white: "#ffffff",
  textDark: "#1f2937",
  textGray: "#6b7280",
};

interface OnboardingSlide {
  id: string;
  image: any;
  title: string;
  subtitle: string;
}

const slides: OnboardingSlide[] = [
  {
    id: "1",
    image: require("../assets/images/ilustracion-3d-mano-dinero-blanco-removebg-preview 1.png"),
    title: "Welcome To\nBizWise",
    subtitle: "Your smart expense manager for business success",
  },
  {
    id: "2",
    image: require("../assets/images/bank-card-mobile-phone-online-payment-removebg-preview 1.png"),
    title: "Take Control of\nYour Finances",
    subtitle: "Track expenses, manage sales, and grow your business",
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();

  const handleNext = async () => {
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex });
      setCurrentIndex(nextIndex);
    } else {
      await completeOnboarding();
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem("hasSeenOnboarding", "true");
    } catch (error) {
      console.error("Error saving onboarding status:", error);
    }
    router.replace("/login");
  };

  const renderSlide = ({
    item,
    index,
  }: {
    item: OnboardingSlide;
    index: number;
  }) => (
    <View style={styles.slide}>
      {/* Top Section with Image */}
      <View style={styles.topSection}>
        {/* Skip Button */}
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Image */}
        <View style={styles.imageWrapper}>
          <View style={styles.circleBackground} />
          <Image
            source={item.image}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Bottom Content Section */}
      <View style={styles.contentContainer}>
        {/* Title */}
        <Text style={styles.title}>{item.title}</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>{item.subtitle}</Text>

        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {slides.map((_, dotIndex) => (
            <View
              key={dotIndex}
              style={[
                styles.dot,
                currentIndex === dotIndex
                  ? styles.activeDot
                  : styles.inactiveDot,
              ]}
            />
          ))}
        </View>

        {/* Next Button */}
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {currentIndex === slides.length - 1 ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.primaryBlue}
      />
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryBlue,
  },
  slide: {
    width: width,
    flex: 1,
  },
  topSection: {
    flex: 1,
    backgroundColor: COLORS.primaryBlue,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 20,
  },
  skipButton: {
    position: "absolute",
    top: 50,
    right: 24,
    padding: 10,
    zIndex: 10,
  },
  skipText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  imageWrapper: {
    width: 280,
    height: 280,
    justifyContent: "center",
    alignItems: "center",
  },
  circleBackground: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  image: {
    width: 240,
    height: 240,
  },
  contentContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 50,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.textDark,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textGray,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  pagination: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 32,
  },
  dot: {
    height: 10,
    borderRadius: 5,
  },
  activeDot: {
    backgroundColor: COLORS.primaryBlue,
    width: 32,
  },
  inactiveDot: {
    backgroundColor: COLORS.circleBg,
    width: 10,
  },
  nextButton: {
    backgroundColor: COLORS.primaryBlue,
    paddingVertical: 18,
    paddingHorizontal: 80,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
  },
  nextButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "700",
  },
});
