import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ImageBackground,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Modal,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Linking,
  AppState,
  BackHandler,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import Markdown from 'react-native-markdown-display';
import AsyncStorage from '@react-native-async-storage/async-storage';

const lessons = require('./data/lessons.json');
const quizzes = require('./data/quizzes.json');

const { width, height } = Dimensions.get('window');

const APP_DOWNLOAD_LINK = `
Download the Takhrij App:
Android: https://play.google.com/store/apps/details?id=com.yourapp.takhrij
iOS: Coming soon
`;

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://takhrij-backend.onrender.com';
const DEFAULT_API_TIMEOUT_MS = 30000;
const NARRATOR_BIO_TIMEOUT_MS = 60000;
const DAILY_FREE_SEARCH_LIMIT = 5;
const SEARCH_LIMIT_STORAGE_KEY = 'takhrij.dailySearchCounter';
const LEARN_PROGRESS_STORAGE_KEY = 'takhrij.learnProgress';
const NAWAWI_HADITH_1 = {
  id: 'nawawi-hadith-1',
  title: 'Hadith 1: Intentions',
  reference: 'Sahih al-Bukhari 1; Sahih Muslim 1907',
  arabic: 'إنما الأعمال بالنيات',
  english: 'Actions are only by intentions.',
  stages: ['Read', 'Understand', 'Memorise', 'Review'],
};

const getTodayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseNarratorNames = (chain = '') => {
  const normalizedChain = String(chain)
    .replace(/Chain of Narrators:?/gi, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalizedChain || /^(?:no chain|chain not available)\.?$/i.test(normalizedChain)) {
    return [];
  }

  if (!/(?:â†’|->|â‡’|ØŒ|,|;)/.test(normalizedChain)) {
    return [];
  }

  const sentencePattern = /[.!?]|\b(?:hadith|narration|report|meaning|lesson|benefit|reader|practice|authenticity|source|reward|virtue|specific|claim|commentary)\b/i;
  const names = normalizedChain
    .split(/\s*(?:→|->|⇒|،|,|;|\n)\s*/)
    .map(name => name.replace(/^\d+\.\s*/, '').trim())
    .filter(name =>
      name.length > 1 &&
      name.length <= 55 &&
      !sentencePattern.test(name) &&
      !/^unknown|unclear|not specified$/i.test(name)
    );

  return names.length >= 2 ? names : [];
};

const postJson = async (path, payload, timeoutMs = DEFAULT_API_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
      body: JSON.stringify({
        ...payload,
        _clientCacheBust: Date.now(),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed with status ${response.status}`);
  }

  return data || {};
};

const COLLECTION_KEY_MAP = {
  'Sahih Bukhari': 'bukhari',
  'Sahih Muslim': 'muslim',
  'Jami` at-Tirmidhi': 'tirmidhi',
  "Sunan an-Nasa'i": 'nasai',
  'Sunan Ibn Majah': 'ibnmajah',
  'Muwatta Malik': 'malik',
  'Musnad Ahmad': 'ahmed',
  'Sunan Abu Dawood': 'abudawud',
  'Sunan ad-Darimi': 'darimi',
};

const getCollectionFromReference = (reference = '') => {
  const normalized = String(reference).toLowerCase();
  if (normalized.includes('bukhari')) return 'bukhari';
  if (normalized.includes('muslim')) return 'muslim';

  const nameParts = String(reference).split(' ').slice(0, 2).join(' ');
  return COLLECTION_KEY_MAP[nameParts] || '';
};

const normalizeAuthenticityStatus = (status, reference = '', collection = '') => {
  const collectionKey = collection || getCollectionFromReference(reference);
  if (collectionKey === 'bukhari' || collectionKey === 'muslim') {
    return 'Sahih by collection';
  }

  return status || 'Not specified in source';
};

const isSearchSuggestionReference = reference =>
  ['Search Suggestions', 'Suggested Searches', 'No Local Match', 'AI Generated'].includes(String(reference || '').trim());

const getAuthenticitySourceLabel = (status = '', source = '') => {
  const normalizedStatus = String(status || '').toLowerCase();
  const normalizedSource = String(source || '').toLowerCase();

  if (!status || normalizedStatus.includes('not specified')) {
    return '';
  }

  if (normalizedStatus.includes('by collection')) {
    return 'Based on collection';
  }

  if (
    normalizedStatus.includes('mentioned in source text') ||
    normalizedStatus.includes('caution noted') ||
    normalizedSource.includes('source text') ||
    normalizedSource.includes('structured source field')
  ) {
    return 'Based on source wording';
  }

  return '';
};

const sanitizeNarratorBioText = (rawBio = '') => {
  const forbiddenPattern = /\b(scholarly remarks|jarh|ta['‘’]?dil|grading|grade|graded|authenticity|trustworthy|reliable|unreliable|weak|thiqah|liar|fabricator|majhul|abandoned|criticism|dispute|disputed)\b/i;
  const allowedLabels = [
    'era/generation',
    'place/region',
    'region',
    'teachers',
    'students',
    'collections',
    'known for',
    'role in hadith transmission',
    'educational note',
    'educational importance'
  ];
  const sectionValues = new Map();
  let currentLabel = null;

  String(rawBio)
    .replace(/```[\s\S]*?```/g, '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .forEach(line => {
      const labelMatch = line.match(/^\*\*([^:*]+):\*\*/);
      if (labelMatch) {
        const label = labelMatch[1].trim().toLowerCase();
        currentLabel = allowedLabels.includes(label) ? label : null;

        if (currentLabel) {
          const value = line.replace(/^\*\*[^:*]+:\*\*\s*/, '').trim();
          if (value && !forbiddenPattern.test(value)) {
            sectionValues.set(currentLabel, value);
          }
        }
        return;
      }

      if (currentLabel && !forbiddenPattern.test(line)) {
        const existing = sectionValues.get(currentLabel);
        sectionValues.set(currentLabel, existing ? `${existing} ${line}` : line);
      }
    });

  const isPlaceholder = value => /^(not listed|not specified|unknown|unclear|n\/a|none)\b/i.test(String(value).trim());
  const knownFor = sectionValues.get('known for') || sectionValues.get('educational importance');
  const safeSections = [
    ['Era/Generation', sectionValues.get('era/generation')],
    ['Place/Region', sectionValues.get('place/region') || sectionValues.get('region')],
    ['Known For', knownFor],
    ['Role in Hadith Transmission', sectionValues.get('role in hadith transmission')],
    ['Teachers', sectionValues.get('teachers')],
    ['Students', sectionValues.get('students')],
    ['Collections', sectionValues.get('collections')],
    ['Educational Note', sectionValues.get('educational note')]
  ].filter(([, value]) => value && !isPlaceholder(value));

  if (!safeSections.length) {
    return '**Educational Note:** Beginner-level historical information for this narrator is not available in this brief summary.';
  }

  return safeSections
    .map(([label, value]) => `**${label}:** ${value}`)
    .join('\n');
};

const getSafeCommentaryText = (text = '') => {
  const trimmed = String(text || '').trim();
  if (!trimmed || /^no commentary\.?$/i.test(trimmed)) {
    return 'Commentary was not available for this hadith. Please refer to qualified scholars for detailed explanation.';
  }
  return trimmed;
};

const glossary = [
  { term: 'Core Concepts', definition: '', reference: '', example: '' },
  {
    "term": "Hadith",
    "definition": "A report of the sayings, actions, approvals, or characteristics of the Prophet Muhammad ﷺ.",
    "reference": "An Introduction to the Science of Hadith by Ibn al-Salah",
    "example": "The Prophet said: 'Actions are judged by intentions.' (Bukhari & Muslim)"
  },
  {
    "term": "Isnad",
    "definition": "The chain of narrators who transmitted the Hadith.",
    "reference": "Nukhbat al-Fikr by Ibn Hajar al-Asqalani",
    "example": "Malik → Nafi' → Ibn Umar → Prophet Muhammad ﷺ"
  },
  {
    "term": "Matn",
    "definition": "The actual text or content of the Hadith.",
    "reference": "Nukhbat al-Fikr by Ibn Hajar al-Asqalani",
    "example": "'Actions are judged by intentions.'"
  },
  {
        "term": "Rawi",
        "definition": "A narrator of Hadith who is part of the chain (Isnad). Rijal criticism examines their integrity and precision.",
        "reference": "Taqrib al-Tahdhib by Ibn Hajar al-Asqalani",
        "example": "Imam Malik is a well-known Rawi often found in the Isnad of authentic Hadiths."
      },
      {
        "term": "Tabi'i",
        "definition": "A Successor who met at least one Companion of the Prophet ﷺ and narrated from them.",
        "reference": "Tabaqat al-Kubra by Ibn Sa'd",
        "example": "Nafi’, the student of Ibn Umar, is a famous Tabi'i and narrator of many Hadiths."
      },
      {
  "term": "Tabi' al-Tabi'in",
  "definition": "The third generation of Muslims who met and learned from the Tabi'in (Successors), but not the Companions themselves.",
  "reference": "Tabaqat al-Kubra by Ibn Sa'd",
  "example": "Sufyan al-Thawri, a renowned scholar of Hadith and Fiqh, is among the notable Tabi' al-Tabi'in. Imām al-Shāfiʿī and Imām Ahmad ibn Hanbal are also from this generation."
},
      { term: 'Types of Narration', definition: '', reference: '', example: '' },
  {
    "term": "Marfu'",
    "definition": "A narration attributed directly to the Prophet Muhammad ﷺ, regardless of the continuity of the chain.",
    "reference": "Nukhbat al-Fikr by Ibn Hajar al-Asqalani",
    "example": "The Prophet said: 'Whoever lies upon me deliberately, let him prepare his seat in the Hellfire.'"
  },
  {
    "term": "Mawquf",
    "definition": "A narration attributed to a Companion of the Prophet ﷺ, without attributing it to the Prophet himself.",
    "reference": "Nukhbat al-Fikr by Ibn Hajar al-Asqalani",
    "example": "Ibn Abbas said: 'The grandfather is treated like a father.'"
  },
  {
    "term": "Maqtu'",
    "definition": "A narration attributed to a Successor (Tabi'i), i.e., the generation after the Companions.",
    "reference": "Nukhbat al-Fikr by Ibn Hajar al-Asqalani",
    "example": "Ibn Sirin said: 'This knowledge is the religion, so be careful from whom you take your religion.'"
  },
  {
    "term": "Qudsi",
    "definition": "A Hadith in which the Prophet Muhammad ﷺ conveys a message from Allah, but unlike the Qur'an, it is in the Prophet’s own words.",
    "reference": "40 Hadith Qudsi, Darussalam",
    "example": "The Prophet ﷺ said: 'Allah said: O My servants, I have forbidden oppression for Myself…'"
  },
  { term: 'Disconnected Chains', definition: '', reference: '', example: '' },
  {
    "term": "Mu'allaq",
    "definition": "A Hadith in which one or more narrators are omitted from the beginning of its chain by the compiler.",
    "reference": "Nukhbat al-Fikr by Ibn Hajar al-Asqalani",
    "example": "Al-Bukhari says: 'The Prophet said...' without mentioning the chain."
  },
  {
    "term": "Mursal",
    "definition": "A Hadith where a Successor (Tabi'i) reports directly from the Prophet, omitting the Companion.",
    "reference": "Nukhbat al-Fikr by Ibn Hajar al-Asqalani",
    "example": "A Tabi'i says: 'The Prophet said...' without mentioning the Companion."
  },
  {
        "term": "Mu’dal",
        "definition": "A Hadith with two or more consecutive narrators missing in the Isnad.",
        "reference": "Nukhbat al-Fikr by Ibn Hajar al-Asqalani",
        "example": "A Tabi’i reports directly from the Prophet, skipping both the Companion and his teacher."
      },
      { term: 'Grading of Hadith', definition: '', reference: '', example: '' },
  {
    "term": "Sahih",
    "definition": "An authentic Hadith that meets all five conditions: continuous chain, upright narrators, precise memory, absence of defects, and no contradiction with stronger reports.",
    "reference": "Nukhbat al-Fikr by Ibn Hajar al-Asqalani",
    "example": "The Prophet said: 'Whoever believes in Allah and the Last Day, let him say good or remain silent.'"
  },
  {
    "term": "Hasan",
    "definition": "A Hadith with a continuous chain and upright narrators, but with slightly less precision in memory compared to Sahih.",
    "reference": "Nukhbat al-Fikr by Ibn Hajar al-Asqalani",
    "example": "The Prophet said: 'Kindness is not found in anything except that it beautifies it.' (Tirmidhi)"
  },
  {
    "term": "Da'if",
    "definition": "A weak Hadith that fails to meet one or more of the conditions of authenticity.",
    "reference": "Nukhbat al-Fikr by Ibn Hajar al-Asqalani",
    "example": "The Prophet said: 'Seek knowledge even if in China.' (Weak due to chain issues)"
  },
  {
    "term": "Da'if Jiddan",
    "definition": "An extremely weak Hadith with severe defects in its chain or content, making it unreliable even for minor rulings or virtues.",
    "reference": "Al-Mawdu'at by Ibn al-Jawzi",
    "example": "A narration reported with multiple broken links and narrators declared untrustworthy."
  },
  {
    "term": "Mawdu'",
    "definition": "A fabricated Hadith falsely attributed to the Prophet ﷺ. It is rejected and impermissible to act upon.",
    "reference": "Al-Mawdu'at by Ibn al-Jawzi",
    "example": "The Prophet ﷺ said: 'Love of the homeland is part of faith.' (Fabricated)"
  },
  { term: 'Frequency of Transmission', definition: '', reference: '', example: '' },
  {
    "term": "Mutawatir",
    "definition": "A Hadith narrated by such a large number of narrators in each generation that it is inconceivable they all agreed upon a lie.",
    "reference": "Nukhbat al-Fikr by Ibn Hajar al-Asqalani",
    "example": "The Prophet said: 'Whoever lies upon me deliberately, let him prepare his seat in the Hellfire.' (Narrated by over 70 Companions)"
  },
  {
    "term": "Ahad",
    "definition": "A Hadith narrated by one or a few narrators in each generation, not reaching the level of Mutawatir.",
    "reference": "Nukhbat al-Fikr by Ibn Hajar al-Asqalani",
    "example": "The Prophet said: 'Actions are judged by intentions.' (Bukhari & Muslim)"
  },
  { term: 'Narrator Criticism', definition: '', reference: '', example: '' },
  {
        "term": "Jarh wa Ta'dil",
        "definition": "The science of criticizing and accrediting Hadith narrators based on their trustworthiness and accuracy.",
        "reference": "Sharh Nukhbat al-Fikr by Ibn Hajar al-Asqalani",
        "example": "Al-Bukhari graded a narrator as 'Thiqah' (trustworthy), while another scholar graded him as 'Da'if' (weak)."
      },
      {
        "term": "Tadlis",
        "definition": "A narrator concealing a defect in the chain, often by omitting the immediate transmitter or using vague terms.",
        "reference": "Sharh Nukhbat al-Fikr by Ibn Hajar",
        "example": "A narrator says 'an fulan' (from so-and-so) without confirming he met him, making the chain possibly disconnected."
      }
];

export default function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeSection, setActiveSection] = useState('search');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [dailySearchCounter, setDailySearchCounter] = useState({ date: getTodayKey(), count: 0 });
  const [learnProgress, setLearnProgress] = useState({ completedLessons: {}, quizAnswers: {} });
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  const [activeQuizIndex, setActiveQuizIndex] = useState(0);
  const [loadingCommentary, setLoadingCommentary] = useState(false);
  const [commentaryModalVisible, setCommentaryModalVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [glossaryModalVisible, setGlossaryModalVisible] = useState(false);
  const [commentaryData, setCommentaryData] = useState({
    commentary: '',
    chain: '',
    evaluation: '',
    authenticityStatus: 'Not specified in source',
    authenticitySource: '',
    sourceCaution: ''
  });
  const scrollRef = useRef(null);
  const insets = useSafeAreaInsets();
  const [donationVisible, setDonationVisible] = useState(false);
  const [thankYouVisible, setThankYouVisible] = useState(false);
  const [pendingDonationThankYou, setPendingDonationThankYou] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const [narratorBioVisible, setNarratorBioVisible] = useState(false);
const [narratorBioText, setNarratorBioText] = useState('');
const [selectedNarrator, setSelectedNarrator] = useState('');
const [returnToCommentaryAfterBio, setReturnToCommentaryAfterBio] = useState(false);
const cardFadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    cardFadeAnim.setValue(0.85);
    Animated.timing(cardFadeAnim, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [activeLessonIndex, activeQuizIndex, cardFadeAnim]);

  useEffect(() => {
    const loadLocalProgress = async () => {
      try {
        const [storedCounter, storedProgress] = await Promise.all([
          AsyncStorage.getItem(SEARCH_LIMIT_STORAGE_KEY),
          AsyncStorage.getItem(LEARN_PROGRESS_STORAGE_KEY),
        ]);
        const today = getTodayKey();
        const parsedCounter = storedCounter ? JSON.parse(storedCounter) : null;
        setDailySearchCounter(
          parsedCounter?.date === today
            ? parsedCounter
            : { date: today, count: 0 }
        );
        if (storedProgress) {
          setLearnProgress(JSON.parse(storedProgress));
        }
      } catch {
        setDailySearchCounter({ date: getTodayKey(), count: 0 });
      }
    };

    loadLocalProgress();
  }, []);

  const saveLearnProgress = async nextProgress => {
    setLearnProgress(nextProgress);
    try {
      await AsyncStorage.setItem(LEARN_PROGRESS_STORAGE_KEY, JSON.stringify(nextProgress));
    } catch {
      // Local progress is helpful but should never block the app.
    }
  };

  const markLessonComplete = lessonId => {
    saveLearnProgress({
      ...learnProgress,
      completedLessons: {
        ...learnProgress.completedLessons,
        [lessonId]: true,
      },
    });
  };

  const answerQuiz = (quizId, selectedIndex, answerIndex) => {
    saveLearnProgress({
      ...learnProgress,
      quizAnswers: {
        ...learnProgress.quizAnswers,
        [quizId]: {
          selectedIndex,
          correct: selectedIndex === answerIndex,
        },
      },
    });
  };

  const toggleMemorisationStage = stage => {
    const currentTracker = learnProgress.memorisation?.[NAWAWI_HADITH_1.id] || {};
    saveLearnProgress({
      ...learnProgress,
      memorisation: {
        ...learnProgress.memorisation,
        [NAWAWI_HADITH_1.id]: {
          ...currentTracker,
          [stage]: !currentTracker[stage],
        },
      },
    });
  };

  const incrementDailySearchCounter = async () => {
    const today = getTodayKey();
    const nextCounter = {
      date: today,
      count: dailySearchCounter.date === today ? dailySearchCounter.count + 1 : 1,
    };
    setDailySearchCounter(nextCounter);
    try {
      await AsyncStorage.setItem(SEARCH_LIMIT_STORAGE_KEY, JSON.stringify(nextCounter));
    } catch {
      // Search should continue even if local storage is unavailable.
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasAwayFromApp =
        appStateRef.current === 'inactive' || appStateRef.current === 'background';

      appStateRef.current = nextAppState;

      if (pendingDonationThankYou && wasAwayFromApp && nextAppState === 'active') {
        setPendingDonationThankYou(false);
        setThankYouVisible(true);
      }
    });

    return () => subscription.remove();
  }, [pendingDonationThankYou]);

  const showPendingDonationThankYou = () => {
    setPendingDonationThankYou(false);
    setThankYouVisible(true);
  };

  const handleDonationPress = async () => {
    try {
      await Linking.openURL('https://www.paypal.me/takhrij');
      setDonationVisible(false);
      setPendingDonationThankYou(true);

      setTimeout(() => {
        if (appStateRef.current === 'active') {
          showPendingDonationThankYou();
        }
      }, 1500);
    } catch {
      setPendingDonationThankYou(false);
      alert('Unable to open PayPal. Please try again later.');
    }
  };
const fetchNarratorBio = async (narratorName) => {
  const cleanNarratorName = narratorName.trim();
  if (!cleanNarratorName) return;

  console.log('[NarratorBio] narrator chip pressed:', cleanNarratorName);
  setSelectedNarrator(cleanNarratorName);
  setReturnToCommentaryAfterBio(commentaryModalVisible);
  setCommentaryModalVisible(false);
  setNarratorBioVisible(true);
  setNarratorBioText('Loading biography...');
  try {
    console.log('[NarratorBio] calling /narrator-bio with:', cleanNarratorName);
    const data = await postJson('/narrator-bio', { name: cleanNarratorName }, NARRATOR_BIO_TIMEOUT_MS);
    console.log('[NarratorBio] /narrator-bio response:', data);
    const raw = data.bio || 'Biography not available.';
    setNarratorBioText(sanitizeNarratorBioText(raw));
  } catch (error) {
    console.log('[NarratorBio] /narrator-bio error:', error);
    setNarratorBioText(error.message || 'Error fetching biography. Please try again.');
  }
};

const closeNarratorBio = () => {
  setNarratorBioVisible(false);

  if (returnToCommentaryAfterBio) {
    setReturnToCommentaryAfterBio(false);
    setTimeout(() => setCommentaryModalVisible(true), 250);
  }
};

  const verifyHadith = async () => {
    setCommentaryModalVisible(false);
    const q = query.trim();
    if (!q) return;
    const today = getTodayKey();
    const searchesUsed = dailySearchCounter.date === today ? dailySearchCounter.count : 0;
    if (searchesUsed >= DAILY_FREE_SEARCH_LIMIT) {
      setResult(
        `---\nEnglish Matn:\nYou have used your ${DAILY_FREE_SEARCH_LIMIT} free searches for today.\n\nCome back tomorrow for more free searches, or continue learning in the Learn section.\n\nReference: No Local Match\nNote: Daily free search limit reached.`
      );
      return;
    }
    setLoading(true);
    setResult('');
    try {
      const data = await postJson('/search-hadith', { query: q });
      setResult(data.result || '');
      await incrementDailySearchCounter();
    } catch {
      setResult('Error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCommentary = async (arabic, english, reference, collection) => {
    setLoadingCommentary(true);
    const eng = english.trim() || arabic.trim();
    const collToSend = collection || getCollectionFromReference(reference) || reference.split(' ').slice(0, 2).join(' ');
    try {
      const json = await postJson('/gpt-commentary', { arabic, english: eng, reference, collection: collToSend });
      const authenticityStatus = normalizeAuthenticityStatus(json.authenticityStatus, reference, collToSend);
      setCommentaryData({
        commentary: getSafeCommentaryText(json.commentary),
        chain: json.chain || 'No chain.',
        evaluation: json.evaluation || '',
        authenticityStatus,
        authenticitySource: getAuthenticitySourceLabel(authenticityStatus, json.authenticitySource),
        sourceCaution: json.sourceCaution || '',
        arabic: arabic || '',
        english: english || '',
        reference: reference || ''
      });
    } catch {
      setCommentaryData({
        commentary: 'Error fetching commentary.',
        chain: '',
        evaluation: '',
        authenticityStatus: 'Not specified in source',
        authenticitySource: '',
        sourceCaution: ''
      });
    } finally {
      setLoadingCommentary(false);
    }
    setCommentaryModalVisible(true);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
  };

  const parseResult = raw => {
    const [extraText, ...blocks] = raw.split('---');
    const hadithSections = blocks.map(s => {
      const arabic = (s.match(/Arabic Matn:\s*([\s\S]*?)(?=\r?\nEnglish Matn:|$)/i) || [])[1]?.trim() || '';
      const reference = (s.match(/Reference:\s*(.*?)$/im) || [])[1]?.trim() || '';
      const isSuggestionFallback = isSearchSuggestionReference(reference);
      let english = (s.match(/English Matn:\s*([\s\S]*?)(?=\r?\nReference:|$)/i) || [])[1]?.trim() || '';
      english = isSuggestionFallback
        ? english.replace(/[*_]/g, '').replace(/\n{3,}/g, '\n\n').trim()
        : english.replace(/[\r\n]+/g, ' ').replace(/[*_]/g, '').trim();
      const rawAuthenticityStatus = (s.match(/Authenticity Status:\s*(.*?)$/im) || [])[1]?.trim() || '';
      const warning = (s.match(/Warning:\s*(.*?)$/im) || [])[1]?.trim() || '';
      const collection = getCollectionFromReference(reference);
      const authenticityStatus = isSuggestionFallback ? '' : normalizeAuthenticityStatus(rawAuthenticityStatus, reference, collection);
      return { arabic, english, reference, authenticityStatus, warning, collection };
    }).filter(o => o.arabic || o.english);
    return { extraText: extraText.trim(), hadithSections };
  };

  const { extraText, hadithSections } = parseResult(result);
  const hasResults = !loading && hadithSections.length > 0;
  const noResults  = !loading && extraText.startsWith('❌');
  const hasSearchOutput = !loading && result.trim().length > 0;

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (loadingCommentary) {
        setLoadingCommentary(false);
        return true;
      }

      if (narratorBioVisible) {
        closeNarratorBio();
        return true;
      }

      if (commentaryModalVisible) {
        setCommentaryModalVisible(false);
        return true;
      }

      if (thankYouVisible) {
        setThankYouVisible(false);
        return true;
      }

      if (donationVisible) {
        setDonationVisible(false);
        return true;
      }

      if (glossaryModalVisible) {
        setGlossaryModalVisible(false);
        return true;
      }

      if (aboutVisible) {
        setAboutVisible(false);
        return true;
      }

      if (hasSearchOutput) {
        setResult('');
        return true;
      }

      return false;
    });

    return () => subscription.remove();
  }, [
    aboutVisible,
    commentaryModalVisible,
    donationVisible,
    glossaryModalVisible,
    hasSearchOutput,
    loadingCommentary,
    narratorBioVisible,
    thankYouVisible,
  ]);

  const premiumFeatures = [
    'Full 40 Hadith Nawawi pathway',
    'Quiz and test mode for each hadith',
    'Advanced memorisation progress',
    'Sahih Bukhari and Sahih Muslim pathway',
    'Narrator and rijal learning cards',
  ];

  const renderNawawiPrototype = () => {
    const tracker = learnProgress.memorisation?.[NAWAWI_HADITH_1.id] || {};
    const completedStages = NAWAWI_HADITH_1.stages.filter(stage => tracker[stage]).length;

    return (
      <View style={styles.learnCard}>
        <View style={styles.learnCardHeader}>
          <Text style={styles.lessonLevel}>Preview</Text>
          <Text style={styles.completedBadge}>{completedStages}/{NAWAWI_HADITH_1.stages.length}</Text>
        </View>
        <Text style={styles.lessonTitle}>{NAWAWI_HADITH_1.title}</Text>
        <Text style={styles.nawawiReference}>{NAWAWI_HADITH_1.reference}</Text>
        <Text style={styles.nawawiArabic}>{NAWAWI_HADITH_1.arabic}</Text>
        <Text style={styles.lessonSummary}>{NAWAWI_HADITH_1.english}</Text>
        <Text style={styles.lessonPoint}>
          Prototype tracker only. The full 40 Hadith Nawawi pathway is planned for a future release.
        </Text>
        <View style={styles.memorisationGrid}>
          {NAWAWI_HADITH_1.stages.map(stage => {
            const done = !!tracker[stage];
            return (
              <Pressable
                key={stage}
                style={[styles.memorisationStep, done && styles.memorisationStepDone]}
                onPress={() => toggleMemorisationStage(stage)}
              >
                <Icon name={done ? 'check-circle' : 'circle'} size={16} color={done ? '#fff' : '#176b5f'} />
                <Text style={[styles.memorisationStepText, done && styles.memorisationStepTextDone]}>
                  {stage}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderCardLearningFlow = () => {
    const lesson = lessons[activeLessonIndex];
    const quiz = quizzes[activeQuizIndex];
    const lessonCompleted = !!learnProgress.completedLessons?.[lesson.id];
    const quizAnswer = learnProgress.quizAnswers?.[quiz.id];
    const quizTriedCount = Object.keys(learnProgress.quizAnswers || {}).length;
    const quizCorrectCount = Object.values(learnProgress.quizAnswers || {}).filter(answer => answer?.correct).length;
    const lessonProgress = ((activeLessonIndex + 1) / lessons.length) * 100;
    const quizProgress = ((activeQuizIndex + 1) / quizzes.length) * 100;

    return (
      <>
        <Animated.View style={[styles.learnCard, styles.flowCard, { opacity: cardFadeAnim }]}>
          <View style={styles.learnCardHeader}>
            <Text style={styles.lessonLevel}>Lesson {activeLessonIndex + 1} of {lessons.length}</Text>
            {lessonCompleted && <Text style={styles.completedBadge}>Completed</Text>}
          </View>
          <View style={styles.flowProgressTrack}>
            <View style={[styles.flowProgressFill, { width: `${lessonProgress}%` }]} />
          </View>
          <Text style={styles.lessonTitle}>{lesson.title}</Text>
          <Text style={styles.lessonSummary}>{lesson.summary}</Text>
          {lesson.points.map(point => (
            <Text key={point} style={styles.lessonPoint}>• {point}</Text>
          ))}
          <Pressable
            style={[styles.learnActionButton, lessonCompleted && styles.learnActionButtonSecondary]}
            onPress={() => markLessonComplete(lesson.id)}
            disabled={lessonCompleted}
          >
            <Text style={styles.learnActionText}>{lessonCompleted ? 'Completed' : 'Mark Complete'}</Text>
          </Pressable>
          <View style={styles.flowControls}>
            <Pressable
              style={[styles.flowButton, activeLessonIndex === 0 && styles.flowButtonDisabled]}
              disabled={activeLessonIndex === 0}
              onPress={() => setActiveLessonIndex(index => Math.max(0, index - 1))}
            >
              <Text style={styles.flowButtonText}>Previous</Text>
            </Pressable>
            <Pressable
              style={[styles.flowButton, activeLessonIndex === lessons.length - 1 && styles.flowButtonDisabled]}
              disabled={activeLessonIndex === lessons.length - 1}
              onPress={() => setActiveLessonIndex(index => Math.min(lessons.length - 1, index + 1))}
            >
              <Text style={styles.flowButtonText}>Next</Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View style={[styles.learnCard, styles.flowCard, { opacity: cardFadeAnim }]}>
          <View style={styles.learnCardHeader}>
            <Text style={styles.lessonLevel}>Quiz {activeQuizIndex + 1} of {quizzes.length}</Text>
            <Text style={styles.completedBadge}>{quizCorrectCount}/{quizTriedCount || 0} correct</Text>
          </View>
          <View style={styles.flowProgressTrack}>
            <View style={[styles.flowProgressFill, { width: `${quizProgress}%` }]} />
          </View>
          <Text style={styles.quizTitle}>{quiz.title}</Text>
          <Text style={styles.quizQuestion}>{quiz.question}</Text>
          {quiz.options.map((option, index) => {
            const selected = quizAnswer?.selectedIndex === index;
            const correctOption = quizAnswer && index === quiz.answerIndex;
            const selectedWrong = selected && quizAnswer && !quizAnswer.correct;
            return (
              <Pressable
                key={option}
                style={[
                  styles.quizOption,
                  selected && styles.quizOptionSelected,
                  selectedWrong && styles.quizOptionWrong,
                  correctOption && styles.quizOptionCorrect,
                ]}
                onPress={() => answerQuiz(quiz.id, index, quiz.answerIndex)}
              >
                <Text style={styles.quizOptionText}>{option}</Text>
              </Pressable>
            );
          })}
          {quizAnswer && (
            <Text style={quizAnswer.correct ? styles.quizFeedbackCorrect : styles.quizFeedbackWrong}>
              {quizAnswer.correct ? 'Correct. ' : 'Not quite. '}
              {quiz.explanation}
            </Text>
          )}
          {!quizAnswer && (
            <Text style={styles.flowHint}>Choose an answer to see feedback before moving on.</Text>
          )}
          <View style={styles.flowControls}>
            <Pressable
              style={[styles.flowButton, activeQuizIndex === 0 && styles.flowButtonDisabled]}
              disabled={activeQuizIndex === 0}
              onPress={() => setActiveQuizIndex(index => Math.max(0, index - 1))}
            >
              <Text style={styles.flowButtonText}>Previous</Text>
            </Pressable>
            <Pressable
              style={[styles.flowButton, (!quizAnswer || activeQuizIndex === quizzes.length - 1) && styles.flowButtonDisabled]}
              disabled={!quizAnswer || activeQuizIndex === quizzes.length - 1}
              onPress={() => setActiveQuizIndex(index => Math.min(quizzes.length - 1, index + 1))}
            >
              <Text style={styles.flowButtonText}>Next</Text>
            </Pressable>
          </View>
          <Text style={styles.flowSummary}>
            Quizzes tried: {quizTriedCount}/{quizzes.length} • Correct: {quizCorrectCount}/{quizTriedCount || 0}
          </Text>
        </Animated.View>
      </>
    );
  };

  const renderLearnSection = () => (
    <>
      <View style={styles.learnHeroCard}>
        <Text style={styles.learnEyebrow}>Beginner learning path</Text>
        <Text style={styles.learnTitle}>Learn the Sciences of Hadith Step by Step</Text>
        <Text style={styles.learnIntro}>
          Short lessons, simple quizzes, and glossary access to help you build confidence before deeper study.
        </Text>
        <Text style={styles.learnProgressSummary}>
          Lessons completed: {Object.keys(learnProgress.completedLessons || {}).length}/{lessons.length} • Quizzes tried: {Object.keys(learnProgress.quizAnswers || {}).length}/{quizzes.length}
        </Text>
      </View>

      {renderCardLearningFlow()}

      <Text style={styles.learnSectionTitle}>40 Hadith Nawawi Preview</Text>
      {renderNawawiPrototype()}

      <Text style={styles.learnSectionTitle}>Future Premium Features</Text>
      <Text style={styles.premiumIntro}>Premium learning paths are planned for a future release.</Text>
      {premiumFeatures.map(feature => (
        <View key={feature} style={styles.lockedCard}>
          <View style={styles.lockedIcon}>
            <Icon name="lock" size={18} color="#d8b15a" />
          </View>
          <View style={styles.lockedCopy}>
            <Text style={styles.lockedTitle}>{feature}</Text>
            <Text style={styles.lockedText}>Locked for future release.</Text>
          </View>
        </View>
      ))}
    </>
  );

  if (showWelcome) {
    return (
      <SafeAreaProvider>
        <ImageBackground
          source={require('./assets/hadith-books-bg.png')}
          style={styles.background}
          resizeMode="cover"
        >
          <View style={styles.dimOverlay} />
          <SafeAreaView style={[styles.welcomeContainer, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <View style={styles.welcomeGlassCard}>
              <Text style={styles.welcomeEyebrow}>A beginner friendly hadith learning app</Text>
              <Text style={styles.welcomeTitle}>Welcome to Takhrij</Text>
              <Text style={styles.welcomeText}>
                Takhrij refers to tracing, identifying, and researching hadith sources and their narrations.
              </Text>
              <Text style={styles.welcomeText}>
                This app helps users search and explore hadith from the collections available on Sunnah.com.
              </Text>
              <Text style={styles.welcomeSectionTitle}>Features include</Text>
              <View style={styles.welcomeBulletList}>
                <Text style={styles.welcomeBullet}>• Search by keywords or phrases</Text>
                <Text style={styles.welcomeBullet}>• View hadith references and narrations</Text>
                <Text style={styles.welcomeBullet}>• Learn basic hadith terminology and narrator information</Text>
                <Text style={styles.welcomeBullet}>• Read concise AI assisted explanations</Text>
              </View>
              <Text style={styles.welcomeDisclaimer}>
                Beginner-friendly research assistance only. Not a replacement for qualified scholars, formal study, or scholarly takhrij.
              </Text>
              <Pressable style={styles.welcomeButton} onPress={() => setShowWelcome(false)}>
                <Text style={styles.welcomeButtonText}>Start Your Search</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </ImageBackground>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.safeArea, { paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#f2f2f2" />

        <Modal visible={loadingCommentary} transparent animationType="none">
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        </Modal>

        <Modal
          visible={commentaryModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setCommentaryModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalHeader}>Hadith Commentary</Text>
              <ScrollView
                ref={scrollRef}
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
              >
                <Text style={styles.sectionHeader}>Authenticity Status</Text>
                <Text style={styles.authenticityStatusText}>{commentaryData.authenticityStatus || 'Not specified in source'}</Text>
                {!!commentaryData.authenticitySource && (
                  <Text style={styles.authenticitySourceText}>{commentaryData.authenticitySource}</Text>
                )}
                {!!commentaryData.sourceCaution && (
                  <Text style={styles.authenticityCautionText}>{commentaryData.sourceCaution}</Text>
                )}
                <Text style={styles.sectionHeader}>Commentary</Text>
                <Text style={styles.modalText}>{commentaryData.commentary}</Text>
                <Text style={styles.sectionHeader}>Chain of Narrators (click to view biography)</Text>
<View style={styles.chainContainer}>
  {parseNarratorNames(commentaryData.chain).map((narrator, idx, arr) => (
    <React.Fragment key={`${narrator}-${idx}`}>
      <TouchableOpacity
        style={styles.narratorChip}
        onPress={() => fetchNarratorBio(narrator)}
        activeOpacity={0.78}
      >
        <Text style={styles.linkText}>{narrator}</Text>
      </TouchableOpacity>
      {idx < arr.length - 1 && (
        <Text style={styles.chainArrow}>→</Text>
      )}
    </React.Fragment>
  ))}
  {parseNarratorNames(commentaryData.chain).length === 0 && (
    <Text style={styles.modalText}>Chain not available.</Text>
  )}
</View>
              </ScrollView>
              <Text style={styles.modalDisclaimer}>
                This AI assisted explanation is for learning and research support only. It may contain mistakes, inaccuracies, or incomplete information. Please verify religious matters with qualified scholars.
              </Text>
              <View style={styles.shareCopyRow}>
                <TouchableOpacity
                  style={styles.shareCopyButton}
                  onPress={async () => {
                    const textToCopy = `Hadith Reference: ${commentaryData.reference}\n\nArabic Matn:\n${commentaryData.arabic}\n\nEnglish Matn:\n${commentaryData.english}\n\nAuthenticity Status:\n${commentaryData.authenticityStatus || 'Not specified in source'}\n\nCommentary:\n${commentaryData.commentary}\n\nChain of Narrators:\n${commentaryData.chain}`;
                    await Clipboard.setStringAsync(textToCopy);
                    alert('Copied to clipboard!');
                  }}
                >
                  <Text style={styles.shareCopyText}>Copy</Text>
                </TouchableOpacity>

                <TouchableOpacity
  style={styles.shareCopyButton}
  onPress={async () => {
    const textToShare = `Hadith Reference: ${commentaryData.reference}\n\nArabic Matn:\n${commentaryData.arabic}\n\nEnglish Matn:\n${commentaryData.english}\n\nAuthenticity Status:\n${commentaryData.authenticityStatus || 'Not specified in source'}\n\nCommentary:\n${commentaryData.commentary}\n\nChain of Narrators:\n${commentaryData.chain}\n\n${APP_DOWNLOAD_LINK}`;
    await Share.share({ message: textToShare });
  }}
>
  <Text style={styles.shareCopyText}>Share</Text>
</TouchableOpacity>

              </View>

              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setCommentaryModalVisible(false)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={narratorBioVisible}
          transparent
          animationType="slide"
          onRequestClose={closeNarratorBio}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalHeader}>{selectedNarrator || 'Narrator Biography'}</Text>
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
              >
                <Markdown style={markdownStyles}>{narratorBioText}</Markdown>
              </ScrollView>
              <Text style={styles.modalDisclaimer}>
                Narrator summaries are educational and may not be complete scholarly biographies. AI generated narrator information may contain errors. Please verify with classical rijāl sources such as Tahdhīb al-Tahdhīb, Taqrīb al-Tahdhīb, Siyar Aʿlām al-Nubalāʾ, and Mīzān al-Iʿtidāl.
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeNarratorBio}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={donationVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setDonationVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalHeader}>Support Takhrij</Text>
              <ScrollView contentContainerStyle={styles.modalScrollContent}>
                <Text style={styles.modalText}>
                  Your donation helps cover server costs, GPT credits, and further development of the app.
                </Text>
                <Text style={styles.modalText}>
                  Every contribution brings us closer to making authentic hadith knowledge accessible to all.
                </Text>

                <TouchableOpacity
                  style={styles.donateButton}
                  onPress={handleDonationPress}
                >
                  <Text style={styles.donateButtonText}>Donate via PayPal</Text>
                </TouchableOpacity>
              </ScrollView>

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setDonationVisible(false)}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={thankYouVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setThankYouVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalHeader}>Thank You!</Text>
              <Text style={styles.modalText}>
                Your support means a lot. JazakAllahu khairan for helping us continue our work.
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setThankYouVisible(false)}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

<Modal
  visible={aboutVisible}
  transparent
  animationType="slide"
  onRequestClose={() => setAboutVisible(false)}
>
  <View style={styles.modalBackdrop}>
    <View style={styles.modalContent}>
      <Text style={styles.modalHeader}>About Takhrij</Text>
      <Text style={styles.modalText}>
        In hadith studies, takhrij is the scholarly process of tracing narrations, identifying their sources, and researching their chains and references.{"\n\n"}
        This app does not perform scholarly takhrij or authoritative hadith verification. It helps beginners search and explore hadith found within indexed datasets based on sources such as Sunnah.com collections and related reference data.{"\n\n"}
        Takhrij is intended as an educational research-assistance tool for learning basic ulum al-hadith concepts, viewing references, exploring narrator chains, and reading concise AI assisted study notes. AI generated explanations may contain errors or incomplete information, so religious matters should be verified with qualified scholars and reliable works of hadith scholarship.
      </Text>
      <TouchableOpacity
        style={styles.modalCloseButton}
        onPress={() => setAboutVisible(false)}
      >
        <Text style={styles.modalCloseText}>Close</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

<Modal
  visible={glossaryModalVisible}
  transparent
  animationType="slide"
  onRequestClose={() => setGlossaryModalVisible(false)}
>
  <View style={styles.modalBackdrop}>
    <View style={styles.modalContent}>
      <Text style={styles.modalHeader}>Hadith Science Glossary</Text>
      <ScrollView contentContainerStyle={styles.modalScrollContent}>
       {glossary.map((item, index) => {
  const isHeader =
    !item.definition &&
    !item.reference &&
    !item.example;

  if (isHeader) {
    return (
      <Text
        key={index}
        style={{
          fontSize: 20,
          fontWeight: '700',
          marginTop: 20,
          marginBottom: 12,
          color: '#16a085',
          textAlign: 'center',
        }}
      >
        {item.term}
      </Text>
    );
  }

  return (
    <View key={index} style={{ marginBottom: 15 }}>
      <Text style={[styles.modalText, { fontWeight: '700' }]}>
        {item.term}
      </Text>

      <Text style={styles.modalText}>
        Definition: {item.definition}
      </Text>

      <Text style={styles.modalText}>
        Reference: {item.reference}
      </Text>

      <Text style={styles.modalText}>
        Example: {item.example}
      </Text>
    </View>
  );
})}
       <Text style={[styles.modalText, { marginTop: 20 }]}>
  <Text style={{ fontWeight: 'bold' }}>Important notice:</Text> <Text style={{ fontStyle: 'italic' }}>This list is not exhaustive. For a deeper study, please refer to the following books on the science of hadith (ʿUlūm al-Hadīth):</Text>
</Text>

                <Text style={[styles.modalText, { marginTop: 10, fontWeight: 'bold' }]}>Arabic Sources:</Text>
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.modalText}>• Nuzhat al-Nazar by Ibn Hajar al-ʿAsqalānī</Text>
                  <Text style={styles.modalText}>• Muqaddimah Ibn al-Salāh by Ibn al-Salāh</Text>
                  <Text style={styles.modalText}>• Tadrīb al-Rāwī by al-Suyūtī</Text>
                </View>

<Text style={[styles.modalText, { marginTop: 10, fontWeight: 'bold' }]}>English Sources:</Text>
<View style={{ marginLeft: 10 }}>
  <Text style={styles.modalText}>• An Introduction to the Science of Hadith by Suhaib Hasan</Text>
  <Text style={styles.modalText}>• Studies in Hadith Methodology and Literature by Muhammad Mustafa Azami</Text>
  <Text style={styles.modalText}>• The Science of Hadith Terminology and Classification by Dr. Muhammad Saeed Mitwally ar-Rahawan</Text>
</View>
  
</ScrollView>
      <TouchableOpacity
        style={styles.modalCloseButton}
        onPress={() => setGlossaryModalVisible(false)}
      >
        <Text style={styles.modalCloseText}>Close</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

        <LinearGradient colors={['#0f2f35', '#176b5f']} style={styles.header}>
          <View style={styles.headerMark}>
            <Icon name="book-open" size={24} color="#d8b15a" />
          </View>
          <Text style={styles.headerText}>Takhrij</Text>
        </LinearGradient>

        <KeyboardAvoidingView
          style={styles.screenContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.sectionTabs}>
              <Pressable
                style={[styles.sectionTab, activeSection === 'search' && styles.sectionTabActive]}
                onPress={() => setActiveSection('search')}
              >
                <Icon name="search" size={17} color={activeSection === 'search' ? '#fff' : '#176b5f'} />
                <Text style={[styles.sectionTabText, activeSection === 'search' && styles.sectionTabTextActive]}>
                  Search
                </Text>
              </Pressable>
              <Pressable
                style={[styles.sectionTab, activeSection === 'learn' && styles.sectionTabActive]}
                onPress={() => setActiveSection('learn')}
              >
                <Icon name="book-open" size={17} color={activeSection === 'learn' ? '#fff' : '#176b5f'} />
                <Text style={[styles.sectionTabText, activeSection === 'learn' && styles.sectionTabTextActive]}>
                  Learn
                </Text>
              </Pressable>
            </View>

            {activeSection === 'search' ? (
            <>
            <View style={styles.searchCard}>
              <Text style={styles.searchTitle}>Find a Hadith</Text>
              <Text style={styles.searchLimitText}>
                Free searches today: {Math.min(dailySearchCounter.date === getTodayKey() ? dailySearchCounter.count : 0, DAILY_FREE_SEARCH_LIMIT)}/{DAILY_FREE_SEARCH_LIMIT}
              </Text>
              <Text style={styles.searchLimitHelp}>
                Free searches reset daily at midnight. Learn, quizzes, and glossary remain free.
              </Text>
              <View style={styles.searchRow}>
                <View style={styles.searchInputWrapper}>
                  <Icon name="search" size={20} color="#888" style={styles.searchIcon} />
                  <TextInput
                    placeholder="Enter topic"
                    placeholderTextColor="#888"
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    returnKeyType="search"
                    onSubmitEditing={verifyHadith}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {query && (
                    <Pressable onPress={() => setQuery('')} style={styles.clearButton}>
                      <Icon name="x" size={20} color="#888" />
                    </Pressable>
                  )}
                </View>
                <Pressable
                  style={[styles.searchButton, loading && styles.searchButtonDisabled]}
                  onPress={verifyHadith}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Icon name="arrow-right" size={24} color="#fff" />}
                </Pressable>
              </View>

              {/* Static Help and Disclaimer Text */}
              {!hasResults && !loading && (
              <View style={styles.helpStaticCard}>
                <Text style={styles.helpStaticText}>
                  How to use: Enter a keyword (e.g. intention) or phrase (e.g. glad tidings to the strangers). The app searches available indexed hadith data based on sources such as Sunnah.com collections and related references.
                </Text>
                <Text style={[styles.helpStaticText, styles.helpDisclaimer]}>
                  Disclaimer: Takhrij is a beginner-friendly educational research aid. It does not replace qualified scholars, formal study, or scholarly takhrij. AI assisted explanations may contain mistakes or incomplete information.
                </Text>
              </View>
              )}
            </View>

<TouchableOpacity style={styles.supportButton} onPress={() => setGlossaryModalVisible(true)}>
  <Text style={styles.supportButtonText}>📚 Ulum Hadith (Sciences of Hadith) Glossary</Text>
</TouchableOpacity>

{!hasResults && (
  
  <>
 <TouchableOpacity style={styles.supportButton} onPress={() => setDonationVisible(true)}>
  <Text style={styles.supportButtonText}>❤️ Support our work and earn Sadaqah Jariyah</Text>
</TouchableOpacity>

  <TouchableOpacity onPress={() => Linking.openURL('mailto:takhrijapp@gmail.com')}>
    <Text style={styles.contactText}>Contact us for feedback and suggestions</Text>
  </TouchableOpacity>

  <TouchableOpacity onPress={() => setAboutVisible(true)}>
    <Text style={styles.contactText}>About the App</Text>
  </TouchableOpacity>

  </>
)}

            {noResults && (
              <View style={styles.noResultCard}>
                <Text style={styles.noResultText}>{extraText}</Text>
              </View>
            )}

            {hasResults && <Text style={styles.resultsTitle}>Results</Text>}

            {hasResults && hadithSections.map((h, i) => (
              <View key={i} style={styles.card}>
                {h.reference && (
                  <View style={styles.referenceBadge}>
                    <Icon name="bookmark" size={14} color="#1b433f" />
                    <Text style={styles.referenceBadgeText}>{h.reference}</Text>
                  </View>
                )}
                {!isSearchSuggestionReference(h.reference) && h.authenticityStatus && (
                  <View style={styles.resultAuthenticityBadge}>
                    <Text style={styles.resultAuthenticityText}>Authenticity: {h.authenticityStatus}</Text>
                  </View>
                )}
                {h.arabic    && <Text style={styles.arabicMatn}>{h.arabic}</Text>}
                {h.english && h.english.split('\n').map((para, index) => (
  <Text key={`english-${index}`} style={styles.englishMatn}>{para.trim()}</Text>
))}
                {h.warning   && <Text style={styles.warning}>{h.warning}</Text>}
                {!isSearchSuggestionReference(h.reference) && (
                  <Pressable
                    style={styles.commentaryButton}
                    onPress={() => fetchCommentary(h.arabic, h.english, h.reference, h.collection)}
                  >
                    <Icon name="message-circle" size={18} color="#fff" style={styles.commentaryIcon} />
                    <Text style={styles.commentaryText}>View Commentary</Text>
                  </Pressable>
                )}
              </View>
            ))}


            {hasResults && (
  <TouchableOpacity style={styles.supportButton} onPress={() => setDonationVisible(true)}>
    <Text style={styles.supportButtonText}>❤️ Support our work and earn Sadaqah Jariyah</Text>
  </TouchableOpacity>
)}
            </>
            ) : (
              renderLearnSection()
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  welcomeContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 24,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  welcomeGlassCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: 'rgba(10, 24, 26, 0.68)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 24,
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 28,
    elevation: 8,
  },
  welcomeEyebrow: {
    color: '#d8b15a',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'left',
    marginBottom: 14,
  },
  welcomeText: {
    fontSize: 15,
    color: '#ecf0f1',
    textAlign: 'left',
    lineHeight: 23,
    marginBottom: 12,
  },
  welcomeSectionTitle: {
    color: '#f7f1df',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
    marginBottom: 8,
  },
  welcomeBulletList: {
    marginBottom: 14,
  },
  welcomeBullet: {
    color: '#ecf0f1',
    fontSize: 15,
    lineHeight: 24,
  },
  welcomeDisclaimer: {
    fontSize: 13,
    lineHeight: 20,
    color: '#d9e3df',
    textAlign: 'left',
    fontStyle: 'italic',
    marginTop: 2,
  },
  welcomeButton: {
    marginTop: 20,
    backgroundColor: '#d8b15a',
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 8,
    alignSelf: 'flex-start',
    shadowColor: '#d8b15a',
    shadowOpacity: 0.26,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 4,
  },
  welcomeButtonText: {
    color: '#132f35',
    fontSize: 16,
    fontWeight: '800',
  },
  arrow: {
  fontSize: 16,
  marginHorizontal: 4,
  color: '#333',
},
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7f4',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    minHeight: 88,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerMark: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
  },
  screenContainer: { flex: 1 },
  container: {
    padding: 18,
    paddingBottom: 42,
  },
  sectionTabs: {
    flexDirection: 'row',
    backgroundColor: '#e7eee5',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d7dfd5',
  },
  sectionTab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sectionTabActive: {
    backgroundColor: '#176b5f',
  },
  sectionTabText: {
    color: '#176b5f',
    fontWeight: '800',
    fontSize: 15,
  },
  sectionTabTextActive: {
    color: '#fff',
  },
  searchCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e3e8df',
    shadowColor: '#102a2e',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3,
  },
  searchTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    color: '#132f35',
  },
  searchLimitText: {
    color: '#607174',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  searchLimitHelp: {
    color: '#607174',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7faf7',
    borderWidth: 1,
    borderColor: '#d7dfd5',
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 54,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#132f35',
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: 10,
    backgroundColor: '#e6ece4',
    borderRadius: 8,
    padding: 5,
  },
  searchButton: {
    backgroundColor: '#176b5f',
    borderRadius: 8,
    width: 54,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#176b5f',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 3,
  },
  searchButtonDisabled: {
    backgroundColor: '#8aa5a0',
  },
  searchHelp: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  helpStaticCard: {
    backgroundColor: '#f4f7f2',
    padding: 14,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e2e9dd',
  },
  helpStaticText: {
    fontSize: 14,
    color: '#41504d',
    marginBottom: 8,
    lineHeight: 21,
  },
  helpDisclaimer: {
    fontWeight: '700',
    color: '#8a3a32',
  },
  noResultCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e3e8df',
  },
 noResultText: {
  color: '#555',
  textAlign: 'left',
  lineHeight: 24,
  marginBottom: 12,
  fontSize: 16
},
  resultsTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#132f35',
    marginBottom: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e0e7dc',
    shadowColor: '#102a2e',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3,
  },
  referenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#edf4e8',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#d7e5ce',
  },
  referenceBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1b433f',
    marginLeft: 6,
  },
  resultAuthenticityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f8f5e9',
    borderWidth: 1,
    borderColor: '#e7d9a8',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 9,
    marginTop: -6,
    marginBottom: 14,
  },
  resultAuthenticityText: {
    color: '#6f5a17',
    fontSize: 12,
    fontWeight: '700',
  },
  arabicMatn: {
    fontSize: 21,
    lineHeight: 34,
    color: '#101f22',
    textAlign: 'right',
    marginBottom: 12,
    fontWeight: '700',
  },
  englishMatn: {
    fontSize: 16,
    lineHeight: 25,
    color: '#2f3d40',
    textAlign: 'left',
    marginBottom: 10,
  },
  fallbackText: {
  fontSize: 16,
  lineHeight: 26,
  color: '#222',
  textAlign: 'left',
  marginVertical: 12,
  paddingHorizontal: 12
},
  learnHeroCard: {
    backgroundColor: '#132f35',
    borderRadius: 8,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#24474d',
  },
  learnEyebrow: {
    color: '#d8b15a',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  learnTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  learnIntro: {
    color: '#d9e3df',
    fontSize: 15,
    lineHeight: 23,
  },
  learnProgressSummary: {
    color: '#f7f1df',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 14,
  },
  learnSectionTitle: {
    color: '#132f35',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 12,
  },
  learnCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e0e7dc',
    shadowColor: '#102a2e',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 2,
  },
  flowCard: {
    padding: 18,
    marginBottom: 16,
  },
  learnCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  flowProgressTrack: {
    height: 6,
    backgroundColor: '#e7eee5',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  flowProgressFill: {
    height: '100%',
    backgroundColor: '#d8b15a',
    borderRadius: 8,
  },
  lessonLevel: {
    color: '#176b5f',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  completedBadge: {
    color: '#176b5f',
    backgroundColor: '#edf4e8',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '800',
  },
  lessonTitle: {
    color: '#132f35',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 10,
  },
  lessonSummary: {
    color: '#2f3d40',
    fontSize: 16,
    lineHeight: 25,
    marginBottom: 12,
  },
  lessonPoint: {
    color: '#41504d',
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 6,
  },
  nawawiReference: {
    color: '#607174',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  nawawiArabic: {
    color: '#132f35',
    fontSize: 22,
    lineHeight: 34,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 10,
  },
  memorisationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  memorisationStep: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d7dfd5',
    backgroundColor: '#f7faf7',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  memorisationStepDone: {
    backgroundColor: '#176b5f',
    borderColor: '#176b5f',
  },
  memorisationStepText: {
    color: '#176b5f',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
  },
  memorisationStepTextDone: {
    color: '#fff',
  },
  learnActionButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#176b5f',
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 15,
    marginTop: 14,
  },
  learnActionButtonSecondary: {
    backgroundColor: '#8aa5a0',
  },
  learnActionText: {
    color: '#fff',
    fontWeight: '800',
  },
  flowControls: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  flowButton: {
    flex: 1,
    backgroundColor: '#176b5f',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  flowButtonDisabled: {
    backgroundColor: '#aebdb8',
  },
  flowButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  flowHint: {
    color: '#607174',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  flowSummary: {
    color: '#607174',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  quizTitle: {
    color: '#176b5f',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  quizQuestion: {
    color: '#132f35',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 25,
    marginBottom: 14,
  },
  quizOption: {
    borderWidth: 1,
    borderColor: '#d7dfd5',
    backgroundColor: '#f7faf7',
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 13,
    marginBottom: 10,
  },
  quizOptionSelected: {
    borderColor: '#d8b15a',
    backgroundColor: '#fbf7ea',
  },
  quizOptionWrong: {
    borderColor: '#b85c4d',
    backgroundColor: '#fff1ef',
  },
  quizOptionCorrect: {
    borderColor: '#176b5f',
    backgroundColor: '#edf4e8',
  },
  quizOptionText: {
    color: '#2f3d40',
    fontSize: 15,
    fontWeight: '700',
  },
  quizFeedbackCorrect: {
    color: '#176b5f',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    marginTop: 6,
  },
  quizFeedbackWrong: {
    color: '#8a3a32',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    marginTop: 6,
  },
  lockedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e7d9a8',
    padding: 14,
    marginBottom: 10,
  },
  premiumIntro: {
    color: '#607174',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  lockedIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#132f35',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  lockedCopy: {
    flex: 1,
  },
  lockedTitle: {
    color: '#132f35',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  lockedText: {
    color: '#607174',
    fontSize: 13,
    lineHeight: 19,
  },
  warning: {
    fontSize: 14,
    lineHeight: 21,
    color: '#8a3a32',
    marginBottom: 10,
    fontWeight: '700',
  },
  commentaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#176b5f',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  commentaryIcon: {
    marginRight: 8,
  },
  commentaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  contactText: {
    fontSize: 14,
    color: '#176b5f',
    textAlign: 'center',
    marginTop: 10,
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    width,
    height,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 23, 26, 0.62)',
    justifyContent: 'center',
    padding: 18,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    maxHeight: height * 0.78,
    padding: 20,
    alignSelf: 'center',
    width: '94%',
    borderWidth: 1,
    borderColor: '#e5e9df',
  },
  modalHeader: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 14,
    textAlign: 'center',
    color: '#132f35',
  },
  modalScroll: {
    marginBottom: 12,
  },
  modalScrollContent: {
    paddingBottom: 8,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 8,
    color: '#176b5f',
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    lineHeight: 25,
    color: '#2f3d40',
  },
  authenticityStatusText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#132f35',
    fontWeight: '700',
    textAlign: 'center',
  },
  authenticitySourceText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#607174',
    textAlign: 'center',
    marginTop: 2,
  },
  authenticityCautionText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#8a3a32',
    backgroundColor: 'rgba(138, 58, 50, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  modalDisclaimer: {
    fontSize: 12,
    color: '#8a3a32',
    marginTop: 16,
    textAlign: 'left',
    fontStyle: 'italic',
  },
  modalCloseButton: {
    marginTop: 18,
    backgroundColor: '#132f35',
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalCloseText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  shareCopyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
  },
  donateButton: {
  backgroundColor: '#176b5f',
  paddingVertical: 13,
  borderRadius: 8,
  marginTop: 16,
},
supportButton: {
  backgroundColor: '#132f35',
  paddingVertical: 14,
  paddingHorizontal: 16,
  borderRadius: 8,
  alignItems: 'center',
  marginBottom: 16,
  shadowColor: '#102a2e',
  shadowOpacity: 0.12,
  shadowOffset: { width: 0, height: 8 },
  shadowRadius: 14,
  elevation: 3,
},
supportButtonContent: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
},
supportButtonIcon: {
  marginRight: 8,
},
supportButtonText: {
  color: '#f7f1df',
  fontSize: 15,
  fontWeight: '800',
  textAlign: 'center',
},
donateButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '800',
  textAlign: 'center',
},
donateLink: {
  color: '#f1c40f',
  fontSize: 14,
  marginTop: 4,
  textDecorationLine: 'underline',
},
  shareCopyButton: {
    backgroundColor: '#176b5f',
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 8,
  },
  shareCopyText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  chainContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginVertical: 8,
  },
  narratorChip: {
    backgroundColor: '#edf4e8',
    borderColor: '#d7e5ce',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginRight: 6,
    marginBottom: 8,
  },
  chainArrow: {
    color: '#8aa5a0',
    fontSize: 16,
    fontWeight: '800',
    marginRight: 6,
    marginBottom: 8,
  },
  linkText: {
    color: '#176b5f',
    fontWeight: '800',
  },
  background: {
    flex: 1,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 20, 22, 0.42)',
  },
});

const markdownStyles = {
  body: {
    color: '#2f3d40',
    fontSize: 16,
    lineHeight: 25,
  },
  strong: {
    color: '#132f35',
    fontWeight: '800',
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 12,
  },
};
