export type Locale = "en" | "ko";

const messages = {
  en: {
    brand: "Seoully",
    tagline: "Your fandom, at home.",
    signIn: "Sign in",
    createAccount: "Create account",
    email: "Email",
    password: "Password",
    continue: "Continue",
    feed: "Feed",
    search: "Search",
    create: "Create",
    messages: "Messages",
    profile: "Profile",
    notConfigured: "Connect the mobile app to the Seoully environment to continue.",
  },
  ko: {
    brand: "Seoully",
    tagline: "좋아하는 마음을, 나의 공간에.",
    signIn: "로그인",
    createAccount: "계정 만들기",
    email: "이메일",
    password: "비밀번호",
    continue: "계속",
    feed: "피드",
    search: "검색",
    create: "만들기",
    messages: "메시지",
    profile: "프로필",
    notConfigured: "계속하려면 모바일 앱을 Seoully 환경에 연결하세요.",
  },
} as const;

export function copy(locale: Locale = "en") {
  return messages[locale];
}
