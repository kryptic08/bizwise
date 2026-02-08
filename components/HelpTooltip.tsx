import { HelpCircle } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const COLORS = {
  primaryBlue: "#3b6ea5",
  white: "#ffffff",
  textDark: "#1f2937",
  overlay: "rgba(0, 0, 0, 0.5)",
};

interface HelpTooltipProps {
  title: string;
  content: string;
  iconColor?: string;
  iconSize?: number;
}

export function HelpTooltip({
  title,
  content,
  iconColor = COLORS.primaryBlue,
  iconSize = 18,
}: HelpTooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.helpCircleBg}
        onPress={() => setVisible(true)}
      >
        <HelpCircle color={iconColor} size={iconSize} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.tooltipContainer}>
            <Text style={styles.tooltipTitle}>{title}</Text>
            <Text style={styles.tooltipContent}>{content}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setVisible(false)}
            >
              <Text style={styles.closeButtonText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  helpCircleBg: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  tooltipContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    maxWidth: 340,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tooltipTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primaryBlue,
    marginBottom: 12,
  },
  tooltipContent: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textDark,
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  closeButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
});
