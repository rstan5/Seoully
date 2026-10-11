import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { motion } from "../theme";

export function useReduceMotion(initial = false) {
  const [reduceMotion, setReduceMotion] = useState(initial);
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

/** null reserves layout while the accessibility preference is being read. */
export function useMotionPreference() {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}
