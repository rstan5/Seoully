import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { motion } from "../theme";

export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduceMotion;
}

export function pressShift(pressed: boolean, reduceMotion: boolean) {
  if (reduceMotion || !pressed) return null;
  return { transform: [{ translateY: motion.pressOffset }] };
}
