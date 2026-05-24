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
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import Markdown from 'react-native-markdown-display';
import AsyncStorage from '@react-native-async-storage/async-storage';

const lessons = require('./data/lessons.json');
const quizzes = require('./data/quizzes.json');
const arbainLearning = require('./data/arbainLearning.json');
const appConfig = require('./app.json');
const nawawiIntroCards = arbainLearning.introCards || [];
const nawawiPreview = arbainLearning.hadiths || [];

const { width, height } = Dimensions.get('window');

const APP_DOWNLOAD_LINK = `
Download the Takhrij App:
Android: https://play.google.com/store/apps/details?id=com.yourapp.takhrij
iOS: Coming soon
`;

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://takhrij-backend.onrender.com';
const APP_VERSION = appConfig?.expo?.version || '1.0.0';
const DEFAULT_API_TIMEOUT_MS = 30000;
const NARRATOR_BIO_TIMEOUT_MS = 60000;
const DAILY_FREE_SEARCH_LIMIT = 5;
const SEARCH_LIMIT_STORAGE_KEY = 'takhrij.dailySearchCounter';
const LEARN_PROGRESS_STORAGE_KEY = 'takhrij.learnProgress';
const DEFAULT_LEARN_PROGRESS = {
  completedLessons: {},
  quizAnswers: {},
  memorisation: {},
  nawawiQuestionChecks: {},
  reviewSchedule: {},
  reviewStreak: { count: 0, lastReviewDate: '' },
};
const REVIEW_INTERVAL_DAYS = [1, 3, 7];
const clampLearningIndex = (value, length) => {
  const index = Number(value);
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.floor(index), 0), Math.max(length - 1, 0));
};
const LEARNING_PATHWAYS = [
  {
    id: 'beginner',
    title: 'Beginner Pathway',
    range: 'Lessons 1-5',
    description: 'Introduction to key hadith terms and transmission basics.',
  },
  {
    id: 'intermediate',
    title: 'Intermediate Pathway',
    range: 'Lessons 6-10',
    description: 'Hadith classification by narrators and authenticity terms.',
  },
  {
    id: 'advanced',
    title: 'Advanced Pathway',
    range: 'Lessons 11-20',
    description: 'Broken chains, hidden issues, fabrication, and technical report types.',
  },
];

const validLessonIds = new Set(lessons.map(lesson => lesson.id));
const validPathwayIds = new Set(LEARNING_PATHWAYS.map(pathway => pathway.id));
const NAWAWI_SELECTION_TITLES = {
  'nawawi-1': 'Hadith 1: Actions Are by Intentions',
  'nawawi-2': 'Hadith 2: Islam, Iman, Ihsan',
  'nawawi-3': 'Hadith 3: The Pillars of Islam',
  'nawawi-4': 'Hadith 4: Creation in the Womb',
  'nawawi-5': 'Hadith 5: Rejected Innovations',
};

const getPathwayLessons = pathwayId => lessons.filter(lesson => lesson.pathway === pathwayId);
const getPathwayQuizzes = pathwayId => quizzes.filter(quiz => quiz.pathway === pathwayId);
const getNawawiHadithCards = hadith => [
  { type: 'hadith', hadith },
  { type: 'meaning', hadith },
  { type: 'vocabulary', hadith },
  { type: 'lessons', hadith },
  ...(hadith.chunks || []).map((chunk, index) => ({
    type: 'chunk',
    hadith,
    chunk,
    chunkIndex: index,
  })),
  ...(hadith.questions || []).map((question, index) => ({
    type: 'question',
    hadith,
    question,
    questionIndex: index,
  })),
  { type: 'reflection', hadith },
  { type: 'checklist', hadith },
];

const getNawawiCards = hadithId => {
  const selectedHadith = hadithId
    ? nawawiPreview.find(hadith => hadith.id === hadithId)
    : null;
  if (selectedHadith) return getNawawiHadithCards(selectedHadith);
  return nawawiPreview.flatMap(getNawawiHadithCards);
};

const getStableHash = value => String(value).split('').reduce((hash, char) => {
  const nextHash = ((hash << 5) - hash) + char.charCodeAt(0);
  return nextHash | 0;
}, 0);

const getShuffledOptions = (options = [], seed = '') => (
  [...options]
    .map((option, index) => ({
      option,
      sort: getStableHash(`${seed}:${option}:${index}`),
    }))
    .sort((a, b) => a.sort - b.sort)
    .map(item => item.option)
);

const sanitizeLearnProgress = progress => {
  const source = progress && typeof progress === 'object' ? progress : {};
  const completedLessons = {};
  Object.entries(source.completedLessons || {}).forEach(([lessonId, completed]) => {
    if (validLessonIds.has(lessonId) && completed) {
      completedLessons[lessonId] = true;
    }
  });

  const quizAnswers = {};
  Object.entries(source.quizAnswers || {}).forEach(([quizId, answer]) => {
    const quiz = quizzes.find(item => item.id === quizId);
    const selectedIndex = answer?.selectedIndex;
    if (
      quiz &&
      answer &&
      typeof answer === 'object' &&
      (
        typeof answer.selectedOption === 'string' ||
        (
          Number.isInteger(selectedIndex) &&
          selectedIndex >= 0 &&
          selectedIndex < quiz.options.length
        )
      )
    ) {
      const selectedOption = typeof answer.selectedOption === 'string'
        ? answer.selectedOption
        : quiz.options[selectedIndex];
      const correctOption = quiz.options[quiz.answerIndex];
      quizAnswers[quizId] = {
        selectedOption,
        correctOption,
        correct: selectedOption === correctOption,
      };
    }
  });

  const memorisation = {};
  Object.entries(source.memorisation || {}).forEach(([hadithId, tracker]) => {
    const hadith = nawawiPreview.find(item => item.id === hadithId);
    if (!hadith || !tracker || typeof tracker !== 'object') return;
    memorisation[hadithId] = {};
    hadith.stages.forEach(stage => {
      if (tracker[stage]) memorisation[hadithId][stage] = true;
    });
  });

  const nawawiQuestionChecks = {};
  Object.entries(source.nawawiQuestionChecks || {}).forEach(([hadithId, checks]) => {
    const hadith = nawawiPreview.find(item => item.id === hadithId);
    if (!hadith || !checks || typeof checks !== 'object') return;
    nawawiQuestionChecks[hadithId] = {};
    (hadith.questions || []).forEach((question, index) => {
      if (typeof question === 'string' && checks[index] === true) {
        nawawiQuestionChecks[hadithId][index] = checks[index];
      } else if (question && typeof question === 'object' && checks[index] && typeof checks[index] === 'object') {
        const selectedOption = checks[index].selectedOption;
        const correctOption = question.options?.[question.answerIndex];
        if (typeof selectedOption === 'string' && typeof correctOption === 'string') {
          nawawiQuestionChecks[hadithId][index] = {
            selectedOption,
            correctOption,
            correct: selectedOption === correctOption,
          };
        }
      } else if (question && typeof question === 'object' && typeof checks[index] === 'number') {
        const selectedOption = question.options?.[checks[index]];
        const correctOption = question.options?.[question.answerIndex];
        if (typeof selectedOption === 'string' && typeof correctOption === 'string') {
          nawawiQuestionChecks[hadithId][index] = {
            selectedOption,
            correctOption,
            correct: selectedOption === correctOption,
          };
        }
      }
    });
  });

  const reviewSchedule = {};
  Object.entries(source.reviewSchedule || {}).forEach(([cardId, review]) => {
    if (!review || typeof review !== 'object') return;
    const intervalIndex = Number.isInteger(review.intervalIndex)
      ? Math.min(Math.max(review.intervalIndex, 0), REVIEW_INTERVAL_DAYS.length - 1)
      : 0;
    reviewSchedule[cardId] = {
      intervalIndex,
      dueDate: typeof review.dueDate === 'string' ? review.dueDate : '',
      lastReviewed: typeof review.lastReviewed === 'string' ? review.lastReviewed : '',
    };
  });

  const reviewStreak = source.reviewStreak && typeof source.reviewStreak === 'object'
    ? {
        count: Number.isInteger(source.reviewStreak.count) && source.reviewStreak.count > 0
          ? source.reviewStreak.count
          : 0,
        lastReviewDate: typeof source.reviewStreak.lastReviewDate === 'string'
          ? source.reviewStreak.lastReviewDate
          : '',
      }
    : DEFAULT_LEARN_PROGRESS.reviewStreak;

  const currentPathwayId = validPathwayIds.has(source.currentPathwayId)
    ? source.currentPathwayId
    : 'beginner';
  const pathwayCardCount = getPathwayLessons(currentPathwayId).length + getPathwayQuizzes(currentPathwayId).length;

  return {
    ...DEFAULT_LEARN_PROGRESS,
    ...source,
    completedLessons,
    quizAnswers,
    memorisation,
    nawawiQuestionChecks,
    reviewSchedule,
    reviewStreak,
    currentPathwayId,
    currentPathwayCardIndex: clampLearningIndex(source.currentPathwayCardIndex, pathwayCardCount || 1),
    currentNawawiCardIndex: clampLearningIndex(source.currentNawawiCardIndex, getNawawiCards().length || 1),
  };
};

const getCompletedLessonCount = progress =>
  lessons.filter(lesson => !!progress.completedLessons?.[lesson.id]).length;

const getQuizTriedCount = progress =>
  quizzes.filter(quiz => !!progress.quizAnswers?.[quiz.id]).length;

const getPathwayLessonProgress = (pathwayId, progress) => {
  const pathwayLessons = getPathwayLessons(pathwayId);
  const completedCount = pathwayLessons.filter(lesson => !!progress.completedLessons?.[lesson.id]).length;
  const percentage = pathwayLessons.length
    ? Math.round((completedCount / pathwayLessons.length) * 100)
    : 0;
  return {
    completedCount,
    total: pathwayLessons.length,
    percentage: Math.min(100, Math.max(0, percentage)),
  };
};

const isPathwayComplete = (pathwayId, progress) => {
  const pathwayLessons = getPathwayLessons(pathwayId);
  const pathwayQuizzes = getPathwayQuizzes(pathwayId);
  const lessonsDone = pathwayLessons.every(lesson => !!progress.completedLessons?.[lesson.id]);
  const quizzesDone = pathwayQuizzes.every(quiz => !!progress.quizAnswers?.[quiz.id]);
  return lessonsDone && quizzesDone;
};

const getPathwayLockMessage = (pathwayId, progress) => {
  if (pathwayId === 'intermediate' && !isPathwayComplete('beginner', progress)) {
    return 'Complete Beginner Pathway to unlock';
  }
  if (pathwayId === 'advanced' && !isPathwayComplete('intermediate', progress)) {
    return 'Complete Intermediate Pathway to unlock';
  }
  return '';
};

const getTodayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDaysToDateKey = (dateKey, days) => {
  const [year, month, day] = String(dateKey || getTodayKey()).split('-').map(Number);
  const date = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Date(year, month - 1, day)
    : new Date();
  date.setDate(date.getDate() + days);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
};

const getReviewCardId = (type, id, extra = '') =>
  extra ? `${type}:${id}:${extra}` : `${type}:${id}`;

const getReviewScheduleForNewCard = () => ({
  intervalIndex: 0,
  dueDate: getTodayKey(),
  lastReviewed: '',
});

const isReviewCardDue = (schedule, todayKey) =>
  !schedule?.dueDate || !schedule?.lastReviewed || schedule.dueDate <= todayKey;

const buildReviewCards = (progress, todayKey = getTodayKey()) => {
  const cards = [];
  const addReviewCard = card => {
    if (card.title && card.prompt && card.sourceLabel) {
      cards.push(card);
    }
  };

  lessons.forEach(lesson => {
    const cardId = getReviewCardId('lesson', lesson.id);
    const schedule = progress.reviewSchedule?.[cardId];
    if (progress.completedLessons?.[lesson.id] && isReviewCardDue(schedule, todayKey)) {
      addReviewCard({
        id: cardId,
        type: 'Lesson',
        sourceLabel: 'Lesson Review',
        title: lesson.title,
        prompt: `Can you explain this lesson in your own words? ${lesson.summary}`,
        selfCheckText: 'I can explain the main idea.',
      });
    }
  });

  quizzes.forEach(quiz => {
    const cardId = getReviewCardId('quiz', quiz.id);
    const schedule = progress.reviewSchedule?.[cardId];
    const answer = progress.quizAnswers?.[quiz.id];
    if (answer && isReviewCardDue(schedule, todayKey)) {
      const correctOption = answer.correctOption || quiz.options[quiz.answerIndex];
      addReviewCard({
        id: cardId,
        type: 'Quiz',
        sourceLabel: 'Quiz Review',
        title: quiz.title,
        prompt: quiz.question,
        answer: correctOption ? `Correct answer: ${correctOption}` : '',
        selfCheckText: 'I reviewed the correct answer.',
      });
    }
  });

  nawawiPreview.forEach(hadith => {
    const tracker = progress.memorisation?.[hadith.id] || {};
    hadith.stages.forEach(stage => {
      const cardId = getReviewCardId('arbain', hadith.id, stage);
      const schedule = progress.reviewSchedule?.[cardId];
      if (tracker[stage] && isReviewCardDue(schedule, todayKey)) {
        addReviewCard({
          id: cardId,
          type: 'Arbain',
          sourceLabel: 'Arbain Review',
          title: `${hadith.title}: ${stage}`,
          prompt: `Review your ${stage.toLowerCase()} checkpoint for this hadith. Recite or explain what you remember before continuing.`,
          selfCheckText: 'I reviewed this checkpoint.',
        });
      }
    });
  });

  return cards;
};

const normalizeReviewCard = card => {
  if (!card || typeof card !== 'object') return null;
  const sourceLabel = String(card.sourceLabel || card.type || 'Review').trim();
  const title = String(card.title || '').trim();
  const prompt = String(card.prompt || card.question || '').trim();
  if (!sourceLabel || !title || !prompt) return null;
  return {
    ...card,
    sourceLabel,
    title,
    prompt,
    answer: card.answer ? String(card.answer).trim() : '',
    selfCheckText: card.selfCheckText ? String(card.selfCheckText).trim() : 'I reviewed this carefully',
  };
};

const getReadyReviewCards = progress =>
  buildReviewCards(progress)
    .map(normalizeReviewCard)
    .filter(Boolean);

const getCurrentReviewStreakCount = (progress, todayKey = getTodayKey()) => {
  const streak = progress.reviewStreak || DEFAULT_LEARN_PROGRESS.reviewStreak;
  if (!streak.lastReviewDate) return 0;
  if (streak.lastReviewDate === todayKey || streak.lastReviewDate === addDaysToDateKey(todayKey, -1)) {
    return streak.count || 0;
  }
  return 0;
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

const formatStructuredSearchResults = results => {
  if (!Array.isArray(results)) return '';

  return results
    .map(item => {
      const arabic = item?.arabic || '';
      const english = item?.english || '';
      const reference = item?.reference || 'Reference under review';
      const authenticityStatus = item?.authenticityStatus || '';
      const warning = item?.sourceCaution || item?.warning || '';

      return [
        '---',
        `Arabic Matn: ${arabic}`,
        `English Matn: ${english}`,
        `Reference: ${reference}`,
        authenticityStatus ? `Authenticity Status: ${authenticityStatus}` : '',
        warning ? `Warning: ${warning}` : ''
      ].filter(Boolean).join('\n');
    })
    .join('\n');
};

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
  const [learnProgress, setLearnProgress] = useState(DEFAULT_LEARN_PROGRESS);
  const learnProgressRef = useRef(DEFAULT_LEARN_PROGRESS);
  const [learnMode, setLearnMode] = useState('overview');
  const [selectedPathwayId, setSelectedPathwayId] = useState('beginner');
  const [activePathwayPreviewIndex, setActivePathwayPreviewIndex] = useState(0);
  const [activePathwayCardIndex, setActivePathwayCardIndex] = useState(0);
  const [selectedNawawiHadithId, setSelectedNawawiHadithId] = useState(nawawiPreview[0]?.id || '');
  const [activeNawawiCardIndex, setActiveNawawiCardIndex] = useState(0);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [reviewSelfChecked, setReviewSelfChecked] = useState(false);
  const [showSearchHelp, setShowSearchHelp] = useState(false);
  const [loadingCommentary, setLoadingCommentary] = useState(false);
  const [commentaryModalVisible, setCommentaryModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
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
const welcomeFadeAnim = useRef(new Animated.Value(0)).current;
const welcomeSlideAnim = useRef(new Animated.Value(16)).current;
const sectionFadeAnim = useRef(new Animated.Value(1)).current;
const sectionSlideAnim = useRef(new Animated.Value(0)).current;
const cardFadeAnim = useRef(new Animated.Value(1)).current;
const cardSlideAnim = useRef(new Animated.Value(0)).current;
const progressAnim = useRef(new Animated.Value(0)).current;
const checklistFeedbackAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(welcomeFadeAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(welcomeSlideAnim, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();
  }, [welcomeFadeAnim, welcomeSlideAnim]);

  useEffect(() => {
    sectionFadeAnim.setValue(0.88);
    sectionSlideAnim.setValue(8);
    Animated.parallel([
      Animated.timing(sectionFadeAnim, {
        toValue: 1,
        duration: 170,
        useNativeDriver: true,
      }),
      Animated.timing(sectionSlideAnim, {
        toValue: 0,
        duration: 170,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeSection, sectionFadeAnim, sectionSlideAnim]);

  useEffect(() => {
    cardFadeAnim.setValue(0.88);
    cardSlideAnim.setValue(10);
    Animated.parallel([
      Animated.timing(cardFadeAnim, {
        toValue: 1,
        duration: 190,
        useNativeDriver: true,
      }),
      Animated.timing(cardSlideAnim, {
        toValue: 0,
        duration: 190,
        useNativeDriver: true,
      }),
    ]).start();
  }, [learnMode, activePathwayCardIndex, selectedNawawiHadithId, activeNawawiCardIndex, activeReviewIndex, cardFadeAnim, cardSlideAnim]);

  const animateProgressTo = percentage => {
    Animated.timing(progressAnim, {
      toValue: Math.min(Math.max(percentage || 0, 0), 100),
      duration: 260,
      useNativeDriver: false,
    }).start();
  };

  const pulseChecklistFeedback = () => {
    checklistFeedbackAnim.setValue(0.96);
    Animated.spring(checklistFeedbackAnim, {
      toValue: 1,
      friction: 5,
      tension: 90,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (learnMode === 'pathway') {
      const totalCards = getPathwayLessons(selectedPathwayId).length + getPathwayQuizzes(selectedPathwayId).length;
      animateProgressTo(totalCards ? ((activePathwayCardIndex + 1) / totalCards) * 100 : 0);
    } else if (learnMode === 'nawawiHadith') {
      const totalCards = getNawawiCards(selectedNawawiHadithId).length;
      animateProgressTo(totalCards ? ((activeNawawiCardIndex + 1) / totalCards) * 100 : 0);
    } else if (learnMode === 'review') {
      const totalCards = getReadyReviewCards(sanitizeLearnProgress(learnProgressRef.current || DEFAULT_LEARN_PROGRESS)).length;
      animateProgressTo(totalCards ? ((activeReviewIndex + 1) / totalCards) * 100 : 0);
    } else {
      progressAnim.setValue(0);
    }
  }, [learnMode, selectedPathwayId, activePathwayCardIndex, selectedNawawiHadithId, activeNawawiCardIndex, activeReviewIndex, progressAnim]);

  useEffect(() => {
    const loadLocalProgress = async () => {
      try {
        const [storedCounter, storedProgress] = await Promise.all([
          AsyncStorage.getItem(SEARCH_LIMIT_STORAGE_KEY),
          AsyncStorage.getItem(LEARN_PROGRESS_STORAGE_KEY),
        ]);
        const today = getTodayKey();
        try {
          const parsedCounter = storedCounter ? JSON.parse(storedCounter) : null;
          setDailySearchCounter(
            parsedCounter?.date === today
              ? parsedCounter
              : { date: today, count: 0 }
          );
        } catch {
          setDailySearchCounter({ date: today, count: 0 });
        }
        try {
          const parsedProgress = storedProgress ? JSON.parse(storedProgress) : DEFAULT_LEARN_PROGRESS;
          const safeProgress = sanitizeLearnProgress(parsedProgress);
          learnProgressRef.current = safeProgress;
          setLearnProgress(safeProgress);
          persistLearnProgress(safeProgress);
          setSelectedPathwayId(safeProgress.currentPathwayId);
          const pathwayCardCount = getPathwayLessons(safeProgress.currentPathwayId).length + getPathwayQuizzes(safeProgress.currentPathwayId).length;
          setActivePathwayCardIndex(clampLearningIndex(safeProgress.currentPathwayCardIndex, pathwayCardCount || 1));
          setActiveNawawiCardIndex(clampLearningIndex(safeProgress.currentNawawiCardIndex, getNawawiCards().length || 1));
        } catch {
          learnProgressRef.current = DEFAULT_LEARN_PROGRESS;
          setLearnProgress(DEFAULT_LEARN_PROGRESS);
        }
      } catch {
        setDailySearchCounter({ date: getTodayKey(), count: 0 });
        learnProgressRef.current = DEFAULT_LEARN_PROGRESS;
        setLearnProgress(DEFAULT_LEARN_PROGRESS);
      }
    };

    loadLocalProgress();
  }, []);

  const persistLearnProgress = async nextProgress => {
    try {
      await AsyncStorage.setItem(LEARN_PROGRESS_STORAGE_KEY, JSON.stringify(nextProgress));
    } catch {
      // Local progress is helpful but should never block the app.
    }
  };

  const updateLearnProgress = updater => {
    const currentProgress = learnProgressRef.current || DEFAULT_LEARN_PROGRESS;
    const nextProgress = sanitizeLearnProgress(updater({
      ...DEFAULT_LEARN_PROGRESS,
      ...currentProgress,
      completedLessons: currentProgress?.completedLessons || {},
      quizAnswers: currentProgress?.quizAnswers || {},
    }));
    learnProgressRef.current = nextProgress;
    setLearnProgress(nextProgress);
    persistLearnProgress(nextProgress);
  };

  const markLessonComplete = lessonId => {
    updateLearnProgress(previousProgress => ({
      ...previousProgress,
      currentPathwayId: selectedPathwayId,
      currentPathwayCardIndex: activePathwayCardIndex,
      completedLessons: {
        ...previousProgress.completedLessons,
        [lessonId]: true,
      },
      reviewSchedule: {
        ...previousProgress.reviewSchedule,
        [getReviewCardId('lesson', lessonId)]: previousProgress.reviewSchedule?.[getReviewCardId('lesson', lessonId)] || getReviewScheduleForNewCard(),
      },
    }));
  };

  const answerQuiz = (quizId, selectedOption, correctOption) => {
    updateLearnProgress(previousProgress => ({
      ...previousProgress,
      currentPathwayId: selectedPathwayId,
      currentPathwayCardIndex: activePathwayCardIndex,
      quizAnswers: {
        ...previousProgress.quizAnswers,
        [quizId]: {
          selectedOption,
          correctOption,
          correct: selectedOption === correctOption,
        },
      },
      reviewSchedule: {
        ...previousProgress.reviewSchedule,
        [getReviewCardId('quiz', quizId)]: previousProgress.reviewSchedule?.[getReviewCardId('quiz', quizId)] || getReviewScheduleForNewCard(),
      },
    }));
  };

  const toggleMemorisationStage = (hadithId, stage) => {
    pulseChecklistFeedback();
    updateLearnProgress(previousProgress => {
      const currentTracker = previousProgress.memorisation?.[hadithId] || {};
      const nextStageValue = !currentTracker[stage];
      const cardId = getReviewCardId('arbain', hadithId, stage);
      return {
        ...previousProgress,
        currentPathwayId: selectedPathwayId,
        currentPathwayCardIndex: activePathwayCardIndex,
        currentNawawiCardIndex: activeNawawiCardIndex,
        memorisation: {
          ...previousProgress.memorisation,
          [hadithId]: {
            ...currentTracker,
            [stage]: nextStageValue,
          },
        },
        reviewSchedule: nextStageValue
          ? {
              ...previousProgress.reviewSchedule,
              [cardId]: previousProgress.reviewSchedule?.[cardId] || getReviewScheduleForNewCard(),
            }
          : previousProgress.reviewSchedule,
      };
    });
  };

  const toggleNawawiQuestionCheck = (hadithId, questionIndex, selectedOption = true, correctOption = '') => {
    updateLearnProgress(previousProgress => {
      const currentChecks = previousProgress.nawawiQuestionChecks?.[hadithId] || {};
      const nextValue = selectedOption === true
        ? !currentChecks[questionIndex]
        : {
            selectedOption,
            correctOption,
            correct: selectedOption === correctOption,
          };
      return {
        ...previousProgress,
        currentNawawiCardIndex: activeNawawiCardIndex,
        nawawiQuestionChecks: {
          ...previousProgress.nawawiQuestionChecks,
          [hadithId]: {
            ...currentChecks,
            [questionIndex]: nextValue,
          },
        },
      };
    });
  };

  const resetLearningProgress = () => {
    Alert.alert(
      'Reset learning progress?',
      'This clears lesson completion, quiz attempts, pathway position, and Arbain checklist progress. Search limits and app settings will not be changed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            learnProgressRef.current = DEFAULT_LEARN_PROGRESS;
            setLearnProgress(DEFAULT_LEARN_PROGRESS);
            setSelectedPathwayId('beginner');
            setActivePathwayPreviewIndex(0);
            setActivePathwayCardIndex(0);
            setSelectedNawawiHadithId(nawawiPreview[0]?.id || '');
            setActiveNawawiCardIndex(0);
            setActiveReviewIndex(0);
            setReviewSelfChecked(false);
            setLearnMode('overview');
            try {
              await AsyncStorage.removeItem(LEARN_PROGRESS_STORAGE_KEY);
            } catch {
              // Reset is a developer convenience; storage errors should not break Learn.
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (learnMode !== 'pathway') return;
    const currentProgress = learnProgressRef.current || DEFAULT_LEARN_PROGRESS;
    if (
      currentProgress.currentPathwayId === selectedPathwayId &&
      currentProgress.currentPathwayCardIndex === activePathwayCardIndex
    ) {
      return;
    }
    const nextProgress = sanitizeLearnProgress({
      ...currentProgress,
      currentPathwayId: selectedPathwayId,
      currentPathwayCardIndex: activePathwayCardIndex,
    });
    learnProgressRef.current = nextProgress;
    setLearnProgress(nextProgress);
    persistLearnProgress(nextProgress);
  }, [learnMode, selectedPathwayId, activePathwayCardIndex]);

  useEffect(() => {
    if (learnMode !== 'nawawiHadith') return;
    const currentProgress = learnProgressRef.current || DEFAULT_LEARN_PROGRESS;
    if (currentProgress.currentNawawiCardIndex === activeNawawiCardIndex) return;
    const nextProgress = sanitizeLearnProgress({
      ...currentProgress,
      currentNawawiCardIndex: activeNawawiCardIndex,
    });
    learnProgressRef.current = nextProgress;
    setLearnProgress(nextProgress);
    persistLearnProgress(nextProgress);
  }, [learnMode, activeNawawiCardIndex]);

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

  setSelectedNarrator(cleanNarratorName);
  setReturnToCommentaryAfterBio(commentaryModalVisible);
  setCommentaryModalVisible(false);
  setNarratorBioVisible(true);
  setNarratorBioText('Loading biography...');
  try {
    const data = await postJson('/narrator-bio', { name: cleanNarratorName }, NARRATOR_BIO_TIMEOUT_MS);
    const raw = data.bio || 'Biography not available.';
    setNarratorBioText(sanitizeNarratorBioText(raw));
  } catch (error) {
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
    if (loading) return;
    setCommentaryModalVisible(false);
    const q = query.trim();
    if (!q) return;
    const today = getTodayKey();
    const searchesUsed = dailySearchCounter.date === today ? dailySearchCounter.count : 0;
    if (!__DEV__ && searchesUsed >= DAILY_FREE_SEARCH_LIMIT) {
      setResult(
        `---\nEnglish Matn:\nYou have used your ${DAILY_FREE_SEARCH_LIMIT} free searches for today.\n\nCome back tomorrow for more free searches, or continue learning in the Learn section.\n\nReference: No Local Match\nNote: Daily free search limit reached.`
      );
      return;
    }
    setLoading(true);
    setResult('');
    try {
      const data = await postJson('/search-hadith', { query: q });
      setResult(data.result || formatStructuredSearchResults(data.results) || '');
      if (!__DEV__) {
        await incrementDailySearchCounter();
      }
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

      if (settingsVisible) {
        setSettingsVisible(false);
        return true;
      }

      if (activeSection === 'learn' && learnMode === 'nawawiHadith') {
        setLearnMode('nawawi');
        return true;
      }

      if (activeSection === 'learn' && learnMode !== 'overview') {
        setLearnMode('overview');
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
    activeSection,
    learnMode,
    loadingCommentary,
    narratorBioVisible,
    settingsVisible,
    thankYouVisible,
  ]);

  const premiumFeatures = [
    'All 40 Hadith Nawawi',
    'Full memorisation tracking',
    'Revision schedule',
    'Narrator flashcards',
    'Sahihayn memorisation pathway',
    'Rijal learning system',
  ];

  const openPathway = pathwayId => {
    const savedProgress = sanitizeLearnProgress(learnProgressRef.current || DEFAULT_LEARN_PROGRESS);
    const lockMessage = getPathwayLockMessage(pathwayId, savedProgress);
    if (lockMessage) return;
    const pathwayCardCount = getPathwayLessons(pathwayId).length + getPathwayQuizzes(pathwayId).length;
    setSelectedPathwayId(pathwayId);
    setActivePathwayCardIndex(
      savedProgress.currentPathwayId === pathwayId
        ? clampLearningIndex(savedProgress.currentPathwayCardIndex, pathwayCardCount || 1)
        : 0
    );
    setLearnMode('pathway');
  };

  const openNawawiItem = () => {
    setLearnMode('nawawi');
  };

  const openNawawiHadith = hadithId => {
    setSelectedNawawiHadithId(hadithId);
    setActiveNawawiCardIndex(0);
    setLearnMode('nawawiHadith');
  };

  const openReviewFlow = () => {
    setActiveReviewIndex(0);
    setReviewSelfChecked(false);
    setLearnMode('review');
  };

  const completeReviewCard = reviewCard => {
    if (!reviewCard) return;
    updateLearnProgress(previousProgress => {
      const today = getTodayKey();
      const currentSchedule = previousProgress.reviewSchedule?.[reviewCard.id] || { intervalIndex: 0 };
      const nextIntervalIndex = Math.min(
        (currentSchedule.intervalIndex || 0) + 1,
        REVIEW_INTERVAL_DAYS.length - 1
      );
      const lastReviewDate = previousProgress.reviewStreak?.lastReviewDate || '';
      let streakCount = previousProgress.reviewStreak?.count || 0;
      if (lastReviewDate !== today) {
        streakCount = lastReviewDate === addDaysToDateKey(today, -1)
          ? streakCount + 1
          : 1;
      }

      return {
        ...previousProgress,
        reviewSchedule: {
          ...previousProgress.reviewSchedule,
          [reviewCard.id]: {
            intervalIndex: nextIntervalIndex,
            dueDate: addDaysToDateKey(today, REVIEW_INTERVAL_DAYS[nextIntervalIndex]),
            lastReviewed: today,
          },
        },
        reviewStreak: {
          count: streakCount,
          lastReviewDate: today,
        },
      };
    });
    setReviewSelfChecked(false);
  };

  const renderPathwayPreviews = () => (
    <View>
      {(() => {
        const safeProgress = sanitizeLearnProgress(learnProgress);
        const pathway = LEARNING_PATHWAYS[activePathwayPreviewIndex] || LEARNING_PATHWAYS[0];
        const pathwayLessons = getPathwayLessons(pathway.id);
        const pathwayQuizzes = getPathwayQuizzes(pathway.id);
        const { completedCount, total, percentage } = getPathwayLessonProgress(pathway.id, safeProgress);
        const progress = percentage;
        const hasStarted = completedCount > 0 || pathwayQuizzes.some(quiz => safeProgress.quizAnswers?.[quiz.id]);
        const lockMessage = getPathwayLockMessage(pathway.id, safeProgress);
        const isLocked = !!lockMessage;

        return (
          <Pressable
            style={[styles.learnCard, isLocked && styles.learnCardLocked]}
            onPress={() => openPathway(pathway.id)}
            disabled={isLocked}
          >
            <View style={styles.learnCardHeader}>
              <Text style={styles.lessonLevel}>{pathway.range}</Text>
              <Text style={styles.completedBadge}>{activePathwayPreviewIndex + 1}/{LEARNING_PATHWAYS.length}</Text>
            </View>
            <Text style={styles.lessonTitle}>{pathway.title}</Text>
            <Text style={styles.lessonSummary}>{pathway.description}</Text>
            <Text style={styles.lessonPoint}>
              Progress: {completedCount}/{pathwayLessons.length} lessons • {progress}%
            </Text>
            <Text style={styles.flowHint}>Study one card at a time, then try the pathway quiz.</Text>
            {isLocked && <Text style={styles.lockedPathwayNotice}>{lockMessage}</Text>}
            <View style={[styles.learnActionButton, isLocked && styles.learnActionButtonDisabled]}>
              <Text style={styles.learnActionText}>
                {isLocked ? 'Locked' : hasStarted ? 'Continue Pathway' : 'Start Pathway'}
              </Text>
            </View>
          </Pressable>
        );
      })()}
      <View style={styles.flowControls}>
        <Pressable
          style={[styles.flowButton, activePathwayPreviewIndex === 0 && styles.flowButtonDisabled]}
          disabled={activePathwayPreviewIndex === 0}
          onPress={() => setActivePathwayPreviewIndex(index => Math.max(0, index - 1))}
        >
          <Text style={styles.flowButtonText}>Previous</Text>
        </Pressable>
        <Pressable
          style={[styles.flowButton, activePathwayPreviewIndex === LEARNING_PATHWAYS.length - 1 && styles.flowButtonDisabled]}
          disabled={activePathwayPreviewIndex === LEARNING_PATHWAYS.length - 1}
          onPress={() => setActivePathwayPreviewIndex(index => Math.min(LEARNING_PATHWAYS.length - 1, index + 1))}
        >
          <Text style={styles.flowButtonText}>Next</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderNawawiOverview = () => (
    <View>
      <Pressable style={styles.learnCard} onPress={openNawawiItem}>
        <View style={styles.learnCardHeader}>
          <Text style={styles.lessonLevel}>Guided memorisation</Text>
          <Text style={styles.completedBadge}>5 hadith</Text>
        </View>
        <Text style={styles.lessonTitle}>Arbain Nawawi Learning Path</Text>
        <Text style={styles.lessonSummary}>Study and memorise the first 5 hadith through short guided cards.</Text>
        <Text style={styles.lessonPoint}>Includes introduction cards, full matn, key vocabulary, lessons, memorisation chunks, active recall, and review checkpoints.</Text>
        <View style={styles.learnActionButton}>
          <Text style={styles.learnActionText}>
            {learnProgress.currentNawawiCardIndex ? 'Continue Arbain Nawawi' : 'Explore Arbain Nawawi'}
          </Text>
        </View>
      </Pressable>
    </View>
  );

  const renderAnimatedProgressBar = () => (
    <View style={styles.flowProgressTrack}>
      <Animated.View
        style={[
          styles.flowProgressFill,
          {
            width: progressAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );

  const renderNawawiPage = () => {
    const introCards = nawawiIntroCards.slice(0, 2);
    return (
      <>
        <View style={styles.learnHeroCard}>
          <Text style={styles.learnEyebrow}>Guided memorisation</Text>
          <Text style={styles.learnTitle}>Arbain Nawawi</Text>
          <Text style={styles.learnIntro}>Learn and memorise the 40 hadith of Imam Nawawi step by step.</Text>
          <Pressable style={styles.arbainBackButton} onPress={() => setLearnMode('overview')}>
            <Text style={styles.arbainBackButtonText}>Back to Learn</Text>
          </Pressable>
        </View>

        <Text style={styles.learnSectionTitle}>Before You Begin</Text>
        {introCards.map(card => (
          <View key={card.id} style={styles.learnCard}>
            <Text style={styles.lessonLevel}>Introduction</Text>
            <Text style={styles.lessonTitle}>{card.title}</Text>
            <Text style={styles.lessonSummary}>{card.body}</Text>
          </View>
        ))}

        <Text style={styles.learnSectionTitle}>Choose a Hadith</Text>
        {nawawiPreview.map((hadith, index) => {
          const tracker = learnProgress.memorisation?.[hadith.id] || {};
          const completedStages = (hadith.stages || []).filter(stage => tracker[stage]).length;
          return (
            <Pressable
              key={hadith.id}
              style={styles.learnCard}
              onPress={() => openNawawiHadith(hadith.id)}
            >
              <View style={styles.learnCardHeader}>
                <Text style={styles.lessonLevel}>Hadith {index + 1}</Text>
                <Text style={styles.completedBadge}>{completedStages}/{hadith.stages.length} checkpoints</Text>
              </View>
              <Text style={styles.lessonTitle}>{NAWAWI_SELECTION_TITLES[hadith.id] || hadith.title}</Text>
              <Text style={styles.nawawiReference}>{hadith.reference}</Text>
              <Text style={styles.lessonSummary}>{hadith.english}</Text>
              <View style={styles.learnActionButton}>
                <Text style={styles.learnActionText}>{completedStages ? 'Continue Hadith' : 'Start Hadith'}</Text>
              </View>
            </Pressable>
          );
        })}
      </>
    );
  };

  const renderPathwayFlow = () => {
    const pathway = LEARNING_PATHWAYS.find(item => item.id === selectedPathwayId) || LEARNING_PATHWAYS[0];
    const pathwayLessons = getPathwayLessons(pathway.id);
    const pathwayQuizzes = getPathwayQuizzes(pathway.id);
    const totalCards = pathwayLessons.length + pathwayQuizzes.length;
    const isQuizCard = activePathwayCardIndex >= pathwayLessons.length;
    const lesson = pathwayLessons[activePathwayCardIndex];
    const quiz = pathwayQuizzes[activePathwayCardIndex - pathwayLessons.length];
    const progress = totalCards ? Math.min(100, ((activePathwayCardIndex + 1) / totalCards) * 100) : 0;

    if (!totalCards) {
      return (
        <View style={styles.learnCard}>
          <Text style={styles.lessonTitle}>Pathway unavailable</Text>
          <Text style={styles.lessonSummary}>Please return to Learn and try another pathway.</Text>
        </View>
      );
    }

    return (
      <Animated.View style={[styles.learnCard, styles.flowCard, { opacity: cardFadeAnim, transform: [{ translateY: cardSlideAnim }] }]}>
        <View style={styles.learnCardHeader}>
          <Text style={styles.lessonLevel}>{pathway.title}</Text>
          <Text style={styles.completedBadge}>{activePathwayCardIndex + 1}/{totalCards}</Text>
        </View>
        {renderAnimatedProgressBar()}
        {!isQuizCard && lesson && (
          <>
            <Text style={styles.lessonTitle}>{lesson.title}</Text>
            <Text style={styles.lessonSummary}>{lesson.summary}</Text>
            {lesson.points.map(point => (
              <Text key={point} style={styles.lessonPoint}>• {point}</Text>
            ))}
            <Pressable
              style={[styles.learnActionButton, learnProgress.completedLessons?.[lesson.id] && styles.learnActionButtonSecondary]}
              onPress={() => markLessonComplete(lesson.id)}
              disabled={!!learnProgress.completedLessons?.[lesson.id]}
            >
              <Text style={styles.learnActionText}>{learnProgress.completedLessons?.[lesson.id] ? 'Completed' : 'Mark Complete'}</Text>
            </Pressable>
          </>
        )}
        {isQuizCard && quiz && (
          <>
            <Text style={styles.quizTitle}>{quiz.title}</Text>
            <Text style={styles.quizQuestion}>{quiz.question}</Text>
            {getShuffledOptions(quiz.options, quiz.id).map(option => {
              const quizAnswer = learnProgress.quizAnswers?.[quiz.id];
              const correctAnswer = quiz.options[quiz.answerIndex];
              const selected = quizAnswer?.selectedOption === option;
              const correctOption = quizAnswer && option === correctAnswer;
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
                  onPress={() => answerQuiz(quiz.id, option, correctAnswer)}
                >
                  <Text style={styles.quizOptionText}>{option}</Text>
                </Pressable>
              );
            })}
            {learnProgress.quizAnswers?.[quiz.id] ? (
              <Text style={learnProgress.quizAnswers[quiz.id].correct ? styles.quizFeedbackCorrect : styles.quizFeedbackWrong}>
                {learnProgress.quizAnswers[quiz.id].correct ? 'Correct. ' : 'Not quite. '}
                {quiz.explanation}
              </Text>
            ) : (
              <Text style={styles.flowHint}>Choose an answer to see feedback before moving on.</Text>
            )}
          </>
        )}
        <View style={styles.flowControls}>
          <Pressable
            style={[styles.flowButton, activePathwayCardIndex === 0 && styles.flowButtonDisabled]}
            disabled={activePathwayCardIndex === 0}
            onPress={() => setActivePathwayCardIndex(index => Math.max(0, index - 1))}
          >
            <Text style={styles.flowButtonText}>Previous</Text>
          </Pressable>
          <Pressable
            style={[styles.flowButton, activePathwayCardIndex === totalCards - 1 && styles.flowButtonDisabled]}
            disabled={activePathwayCardIndex === totalCards - 1}
            onPress={() => setActivePathwayCardIndex(index => Math.min(totalCards - 1, index + 1))}
          >
            <Text style={styles.flowButtonText}>Next</Text>
          </Pressable>
        </View>
        <Pressable style={styles.secondaryTextButton} onPress={() => setLearnMode('overview')}>
          <Text style={styles.secondaryTextButtonText}>Back to pathways</Text>
        </Pressable>
      </Animated.View>
    );
  };

  const renderNawawiFlow = () => {
    const selectedHadith = nawawiPreview.find(hadith => hadith.id === selectedNawawiHadithId) || nawawiPreview[0];
    const nawawiCards = getNawawiCards(selectedHadith?.id);
    const totalCards = nawawiCards.length;
    const card = nawawiCards[activeNawawiCardIndex] || nawawiCards[0];
    if (!card) return null;
    const { hadith } = card;
    const tracker = hadith ? learnProgress.memorisation?.[hadith.id] || {} : {};
    const questionChecks = hadith ? learnProgress.nawawiQuestionChecks?.[hadith.id] || {} : {};
    const rawQuestionCheck = questionChecks[card.questionIndex];
    const questionReviewed = rawQuestionCheck || false;
    const progress = totalCards ? Math.min(100, ((activeNawawiCardIndex + 1) / totalCards) * 100) : 0;
    const cardLabel = card.type === 'intro'
      ? 'Introduction'
      : card.type === 'hadith'
        ? 'Full Matn'
        : card.type === 'meaning'
          ? 'Simple Meaning'
          : card.type === 'vocabulary'
            ? 'Key Vocabulary'
            : card.type === 'lessons'
              ? 'Main Lessons'
              : card.type === 'chunk'
                ? `Memorisation Chunk ${card.chunkIndex + 1}`
                : card.type === 'reflection'
                  ? 'Reflection'
                  : card.type === 'checklist'
                    ? 'Review Checklist'
                    : 'Active Recall';

    return (
      <Animated.View style={[styles.learnCard, styles.flowCard, { opacity: cardFadeAnim, transform: [{ translateY: cardSlideAnim }] }]}>
        <View style={styles.learnCardHeader}>
          <Text style={styles.lessonLevel}>Arbain Nawawi • {cardLabel}</Text>
          <Text style={styles.completedBadge}>{activeNawawiCardIndex + 1}/{totalCards}</Text>
        </View>
        {renderAnimatedProgressBar()}
        {card.type === 'intro' ? (
          <>
            <Text style={styles.lessonTitle}>{card.card.title}</Text>
            <Text style={styles.lessonSummary}>{card.card.body}</Text>
          </>
        ) : card.type === 'hadith' ? (
          <>
            <Text style={styles.lessonTitle}>{hadith.title}</Text>
            <Text style={styles.nawawiReference}>{hadith.reference}</Text>
            <Text style={styles.nawawiReference}>Narrator: {hadith.narrator}</Text>
            <Text style={styles.nawawiArabic}>{hadith.arabic}</Text>
            <Text style={styles.flowHint}>Read the full matn slowly before practicing smaller chunks.</Text>
          </>
        ) : card.type === 'meaning' ? (
          <>
            <Text style={styles.lessonTitle}>{hadith.title}</Text>
            <Text style={styles.lessonSummary}>{hadith.english}</Text>
            <Text style={styles.flowHint}>This is a simple learning meaning, not a detailed translation commentary.</Text>
          </>
        ) : card.type === 'vocabulary' ? (
          <>
            <Text style={styles.lessonTitle}>{hadith.title}</Text>
            {(hadith.vocabulary || []).map(item => (
              <View key={item.term} style={styles.vocabularyItem}>
                <Text style={styles.vocabularyTerm}>{item.term}</Text>
                <Text style={styles.lessonSummary}>{item.meaning}</Text>
              </View>
            ))}
          </>
        ) : card.type === 'lessons' ? (
          <>
            <Text style={styles.lessonTitle}>{hadith.title}</Text>
            {(hadith.lessons || []).map(point => (
              <Text key={point} style={styles.lessonPoint}>• {point}</Text>
            ))}
          </>
        ) : card.type === 'chunk' ? (
          <>
            <Text style={styles.lessonTitle}>{hadith.title}</Text>
            <Text style={styles.nawawiQuestionTitle}>Read this chunk aloud</Text>
            <Text style={styles.nawawiArabic}>{card.chunk}</Text>
            <Text style={styles.lessonSummary}>Cover the screen after reading, then try to recite this phrase from memory.</Text>
          </>
        ) : card.type === 'reflection' ? (
          <>
            <Text style={styles.lessonTitle}>{hadith.title}</Text>
            <Text style={styles.lessonSummary}>{hadith.reflection}</Text>
          </>
        ) : card.type === 'checklist' ? (
          <>
            <Text style={styles.lessonTitle}>{hadith.title}</Text>
            <Text style={styles.flowHint}>
              Checklist progress: {hadith.stages.filter(stage => tracker[stage]).length}/{hadith.stages.length}
            </Text>
            <View style={styles.memorisationGrid}>
              {hadith.stages.map(stage => {
                const done = !!tracker[stage];
                return (
                  <Animated.View key={stage} style={done ? { transform: [{ scale: checklistFeedbackAnim }] } : null}>
                    <Pressable
                      style={[styles.memorisationStep, done && styles.memorisationStepDone]}
                      onPress={() => toggleMemorisationStage(hadith.id, stage)}
                    >
                      <Text style={[styles.memorisationStepText, done && styles.memorisationStepTextDone]}>
                        {done ? `${stage} done` : stage}
                      </Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </>
        ) : hadith ? (
          <>
            <Text style={styles.nawawiQuestionTitle}>Learning Question</Text>
            {typeof card.question === 'string' ? (
              <>
                <Text style={styles.quizQuestion}>{card.question}</Text>
                <Text style={styles.lessonSummary}>Pause and answer in your own words before moving on.</Text>
                <Pressable
                  style={[styles.learnActionButton, questionReviewed && styles.learnActionButtonSecondary]}
                  onPress={() => toggleNawawiQuestionCheck(hadith.id, card.questionIndex)}
                >
                  <Text style={styles.learnActionText}>{questionReviewed ? 'Self Check Completed' : 'Mark Self Check'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.quizQuestion}>{card.question.prompt}</Text>
                {getShuffledOptions(card.question.options, `${hadith.id}:${card.questionIndex}`).map(option => {
                  const correctAnswer = card.question.options[card.question.answerIndex];
                  const selected = questionReviewed?.selectedOption === option;
                  const correctOption = !!questionReviewed && option === correctAnswer;
                  const selectedWrong = selected && !questionReviewed.correct;
                  return (
                    <Pressable
                      key={option}
                      style={[
                        styles.quizOption,
                        selected && styles.quizOptionSelected,
                        selectedWrong && styles.quizOptionWrong,
                        correctOption && styles.quizOptionCorrect,
                      ]}
                      onPress={() => toggleNawawiQuestionCheck(hadith.id, card.questionIndex, option, correctAnswer)}
                    >
                      <Text style={styles.quizOptionText}>{option}</Text>
                    </Pressable>
                  );
                })}
                {questionReviewed !== false ? (
                  <Text style={questionReviewed.correct ? styles.quizFeedbackCorrect : styles.quizFeedbackWrong}>
                    {questionReviewed.correct ? 'Correct. ' : 'Not quite. '}
                    {card.question.explanation}
                  </Text>
                ) : (
                  <Text style={styles.flowHint}>Choose an answer to check the phrase.</Text>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <Text style={styles.lessonTitle}>Arbain Nawawi</Text>
            <Text style={styles.lessonSummary}>This card is not available.</Text>
          </>
        )}
        <View style={styles.flowControls}>
          <Pressable
            style={[styles.flowButton, activeNawawiCardIndex === 0 && styles.flowButtonDisabled]}
            disabled={activeNawawiCardIndex === 0}
            onPress={() => setActiveNawawiCardIndex(index => Math.max(0, index - 1))}
          >
            <Text style={styles.flowButtonText}>Previous</Text>
          </Pressable>
          <Pressable
            style={[styles.flowButton, activeNawawiCardIndex === totalCards - 1 && styles.flowButtonDisabled]}
            disabled={activeNawawiCardIndex === totalCards - 1}
            onPress={() => setActiveNawawiCardIndex(index => Math.min(totalCards - 1, index + 1))}
          >
            <Text style={styles.flowButtonText}>Next</Text>
          </Pressable>
        </View>
        <Pressable style={styles.secondaryTextButton} onPress={() => setLearnMode('nawawi')}>
          <Text style={styles.secondaryTextButtonText}>Back to Arbain</Text>
        </Pressable>
      </Animated.View>
    );
  };

  const renderReviewFlow = () => {
    const safeProgress = sanitizeLearnProgress(learnProgress);
    const reviewCards = getReadyReviewCards(safeProgress);
    const safeReviewIndex = clampLearningIndex(activeReviewIndex, reviewCards.length || 1);
    const reviewCard = reviewCards[safeReviewIndex];

    if (!reviewCard) {
      return (
        <View style={styles.learnCard}>
          <Text style={styles.lessonTitle}>Today’s Review Complete</Text>
          <Text style={styles.lessonSummary}>No review content available yet. Complete a lesson or quiz first.</Text>
          <Pressable style={styles.secondaryTextButton} onPress={() => setLearnMode('overview')}>
            <Text style={styles.secondaryTextButtonText}>Back to Learn</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <Animated.View style={[styles.learnCard, styles.flowCard, { opacity: cardFadeAnim, transform: [{ translateY: cardSlideAnim }] }]}>
        <View style={styles.learnCardHeader}>
          <Text style={styles.lessonLevel}>Today’s Review</Text>
          <Text style={styles.completedBadge}>{safeReviewIndex + 1}/{reviewCards.length}</Text>
        </View>
        {renderAnimatedProgressBar()}
        <Text style={styles.quizTitle}>{reviewCard.sourceLabel}</Text>
        <Text style={styles.lessonTitle}>{reviewCard.title}</Text>
        <Text style={styles.quizQuestion}>{reviewCard.prompt}</Text>
        {!!reviewCard.answer && <Text style={styles.lessonSummary}>{reviewCard.answer}</Text>}
        <Pressable
          style={[styles.reviewCheckButton, reviewSelfChecked && styles.reviewCheckButtonDone]}
          onPress={() => setReviewSelfChecked(true)}
        >
          <Text style={[styles.reviewCheckText, reviewSelfChecked && styles.reviewCheckTextDone]}>
            {reviewSelfChecked ? 'Self check completed' : reviewCard.selfCheckText || 'I reviewed this carefully'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.learnActionButton, !reviewSelfChecked && styles.learnActionButtonDisabled]}
          disabled={!reviewSelfChecked}
          onPress={() => {
            completeReviewCard(reviewCard);
            setActiveReviewIndex(index => Math.min(index, Math.max(reviewCards.length - 2, 0)));
          }}
        >
          <Text style={styles.learnActionText}>Continue</Text>
        </Pressable>
        <Pressable style={styles.secondaryTextButton} onPress={() => setLearnMode('overview')}>
          <Text style={styles.secondaryTextButtonText}>Back to Learn</Text>
        </Pressable>
      </Animated.View>
    );
  };

  const renderLearnSection = () => {
    const safeProgress = sanitizeLearnProgress(learnProgress);
    const completedLessonCount = getCompletedLessonCount(safeProgress);
    const quizTriedCount = getQuizTriedCount(safeProgress);
    const pathwayProgress = lessons.length
      ? Math.min(100, Math.round((completedLessonCount / lessons.length) * 100))
      : 0;
    const currentPathway = LEARNING_PATHWAYS.find(item => item.id === safeProgress.currentPathwayId || item.id === selectedPathwayId) || LEARNING_PATHWAYS[0];
    const currentPathwayLessons = getPathwayLessons(currentPathway.id);
    const currentPathwayQuizzes = getPathwayQuizzes(currentPathway.id);
    const safePathwayIndex = clampLearningIndex(safeProgress.currentPathwayCardIndex, currentPathwayLessons.length + currentPathwayQuizzes.length || 1);
    const isResumeQuiz = safePathwayIndex >= currentPathwayLessons.length;
    const currentLessonLabel = isResumeQuiz
      ? `Continue ${currentPathway.title}: Quiz ${safePathwayIndex - currentPathwayLessons.length + 1} of ${currentPathwayQuizzes.length}`
      : `${currentPathway.title}: Lesson ${safePathwayIndex + 1} of ${currentPathwayLessons.length}`;
    const reviewCards = getReadyReviewCards(safeProgress);
    const reviewStreakCount = getCurrentReviewStreakCount(safeProgress);

    if (learnMode === 'nawawi') {
      return renderNawawiPage();
    }

    if (learnMode === 'nawawiHadith') {
      return renderNawawiFlow();
    }

    return (
    <>
      <View style={styles.learnHeroCard}>
        <Text style={styles.learnEyebrow}>Free learning previews</Text>
        <Text style={styles.learnTitle}>Hadith Learning Pathways</Text>
        <Text style={styles.learnIntro}>
          Beginner, Intermediate, and Advanced previews help you study the sciences of hadith step by step. All three pathway previews are free for now.
        </Text>
        <View style={styles.continueLearningCard}>
          <Text style={styles.continueLearningLabel}>Continue Learning</Text>
          <Text style={styles.continueLearningText}>{currentLessonLabel}</Text>
          <Text style={styles.continueLearningMeta}>Overall pathway progress: {pathwayProgress}%</Text>
          <Text style={styles.continueLearningMeta}>{currentPathway.title}: {getPathwayLessonProgress(currentPathway.id, safeProgress).percentage}% complete</Text>
          {__DEV__ && (
            <Pressable style={styles.resetLearnButton} onPress={resetLearningProgress}>
              <Text style={styles.resetLearnButtonText}>Reset learning progress</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.learnProgressSummary}>
          Lessons completed: {completedLessonCount}/{lessons.length} • Quizzes tried: {quizTriedCount}/{quizzes.length}
        </Text>
        <View style={styles.dailyReviewCard}>
          <View style={styles.learnCardHeader}>
            <Text style={styles.continueLearningLabel}>Today’s Review</Text>
            <Text style={styles.completedBadge}>{reviewCards.length} cards ready</Text>
          </View>
          <Text style={styles.continueLearningText}>
            {reviewCards.length ? 'Review one card to keep your learning fresh.' : 'No review content available yet. Complete a lesson or quiz first.'}
          </Text>
          <Text style={styles.continueLearningMeta}>Daily review streak: {reviewStreakCount} day{reviewStreakCount === 1 ? '' : 's'}</Text>
          <Pressable
            style={[styles.reviewStartButton, !reviewCards.length && styles.learnActionButtonDisabled]}
            disabled={!reviewCards.length}
            onPress={openReviewFlow}
          >
            <Text style={styles.learnActionText}>{reviewCards.length ? 'Start Today’s Review' : 'Review Complete'}</Text>
          </Pressable>
        </View>
      </View>

      {learnMode === 'overview' && (
        <>
          <Text style={styles.learnSectionTitle}>Pathway Previews</Text>
          {renderPathwayPreviews()}

          <Text style={styles.learnSectionTitle}>Arbain Nawawi Learning</Text>
          {renderNawawiOverview()}

          <Text style={styles.learnSectionTitle}>Future Paid Version</Text>
          <Text style={styles.premiumIntro}>A future paid version is planned to include deeper guided study tools.</Text>
          {premiumFeatures.map(feature => (
            <View key={feature} style={styles.lockedCard}>
              <View style={styles.lockedCopy}>
                <Text style={styles.lockedTitle}>{feature}</Text>
                <Text style={styles.lockedText}>Locked for future release.</Text>
              </View>
            </View>
          ))}
        </>
      )}
      {learnMode === 'pathway' && renderPathwayFlow()}
      {learnMode === 'review' && renderReviewFlow()}
    </>
    );
  };

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
            <Animated.View
              style={[
                styles.welcomeGlassCard,
                {
                  opacity: welcomeFadeAnim,
                  transform: [{ translateY: welcomeSlideAnim }],
                },
              ]}
            >
              <Text style={styles.welcomeEyebrow}>Learn, search, and memorise hadith step by step.</Text>
              <Text style={styles.welcomeTitle}>Welcome to Takhrij</Text>
              <Text style={styles.welcomeText}>
                Takhrij helps beginners explore hadith with guided learning pathways, daily review cards, Arbain Nawawi memorisation, quizzes, and accurate reference based search.
              </Text>
              <Text style={styles.welcomeSectionTitle}>Features include</Text>
              <View style={styles.welcomeBulletList}>
                <Text style={styles.welcomeBullet}>• Search hadith by keyword or reference</Text>
                <Text style={styles.welcomeBullet}>• Learn the sciences of hadith through guided cards</Text>
                <Text style={styles.welcomeBullet}>• Review daily to strengthen retention</Text>
                <Text style={styles.welcomeBullet}>• Memorise selected hadith from Arbain Nawawi</Text>
                <Text style={styles.welcomeBullet}>• Track progress across lessons and quizzes</Text>
              </View>
              <Text style={styles.welcomeDisclaimer}>
                Takhrij is an educational research aid and does not replace qualified scholars, formal study, or scholarly takhrij.
              </Text>
              <Pressable style={styles.welcomeButton} onPress={() => setShowWelcome(false)}>
                <Text style={styles.welcomeButtonText}>Start Learning</Text>
              </Pressable>
            </Animated.View>
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
  visible={settingsVisible}
  transparent
  animationType="slide"
  onRequestClose={() => setSettingsVisible(false)}
>
  <View style={styles.modalBackdrop}>
    <View style={styles.modalContent}>
      <Text style={styles.modalHeader}>Settings</Text>
      <ScrollView contentContainerStyle={styles.modalScrollContent}>
        <Text style={styles.settingsSectionTitle}>About Takhrij</Text>
        <Text style={styles.modalText}>
          Takhrij helps beginners search hadith references and learn the sciences of hadith through guided cards, quizzes, Daily Review, and Arbain Nawawi memorisation.
        </Text>

        <Text style={styles.settingsSectionTitle}>Educational Disclaimer</Text>
        <Text style={styles.modalText}>
          Takhrij is an educational research aid. It does not replace qualified scholars, formal study, or scholarly takhrij. AI assisted explanations may contain mistakes, so religious matters should be verified with reliable scholarship.
        </Text>

        <Text style={styles.settingsSectionTitle}>App Version</Text>
        <Text style={styles.modalText}>Version {APP_VERSION}</Text>

        <Text style={styles.settingsSectionTitle}>Contact / Feedback</Text>
        <Text style={styles.modalText}>Feedback form and support contact will be added in a future update.</Text>

        <Text style={styles.settingsSectionTitle}>Restore Purchases</Text>
        <Text style={styles.modalText}>Restore purchases will be available when premium features are introduced.</Text>

        {__DEV__ && (
          <Pressable style={styles.settingsResetButton} onPress={resetLearningProgress}>
            <Text style={styles.settingsResetButtonText}>Reset learning progress</Text>
          </Pressable>
        )}
      </ScrollView>
      <TouchableOpacity
        style={styles.modalCloseButton}
        onPress={() => setSettingsVisible(false)}
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
          <Text style={styles.headerText}>Takhrij</Text>
          <Pressable style={styles.headerSettingsButton} onPress={() => setSettingsVisible(true)}>
            <Text style={styles.headerSettingsText}>Settings</Text>
          </Pressable>
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
                <Text style={[styles.sectionTabText, activeSection === 'search' && styles.sectionTabTextActive]}>
                  Search
                </Text>
              </Pressable>
              <Pressable
                style={[styles.sectionTab, activeSection === 'learn' && styles.sectionTabActive]}
                onPress={() => setActiveSection('learn')}
              >
                <Text style={[styles.sectionTabText, activeSection === 'learn' && styles.sectionTabTextActive]}>
                  Learn
                </Text>
              </Pressable>
            </View>

            <Animated.View style={{ opacity: sectionFadeAnim, transform: [{ translateY: sectionSlideAnim }] }}>
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
                  <TextInput
                    placeholder="Enter hadith, keyword, or topic"
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
                      <Text style={styles.clearButtonText}>Clear</Text>
                    </Pressable>
                  )}
                </View>
                <Pressable
                  style={[styles.searchButton, loading && styles.searchButtonDisabled]}
                  onPress={verifyHadith}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchButtonText}>Search</Text>}
                </Pressable>
              </View>

              {!hasResults && !loading && (
                <View style={styles.helpStaticCard}>
                  <Pressable style={styles.helpToggle} onPress={() => setShowSearchHelp(value => !value)}>
                    <Text style={styles.helpToggleText}>
                      {showSearchHelp ? 'Hide search tips' : 'Search tips and disclaimer'}
                    </Text>
                  </Pressable>
                  {showSearchHelp && (
                    <>
                      <Text style={styles.helpStaticText}>
                        Search by keyword or exact phrase. Exact Arabic or English wording usually gives better results.
                      </Text>
                      <Text style={[styles.helpStaticText, styles.helpDisclaimer]}>
                        Takhrij is an educational research aid. It does not replace qualified scholars, formal study, or scholarly takhrij.
                      </Text>
                    </>
                  )}
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
            </Animated.View>
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
  headerText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
  },
  headerSettingsButton: {
    position: 'absolute',
    right: 16,
    bottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  headerSettingsText: {
    color: '#f7f1df',
    fontSize: 12,
    fontWeight: '800',
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
    paddingVertical: 7,
    paddingHorizontal: 9,
  },
  clearButtonText: {
    color: '#607174',
    fontSize: 12,
    fontWeight: '800',
  },
  searchButton: {
    backgroundColor: '#176b5f',
    borderRadius: 8,
    minWidth: 86,
    height: 54,
    paddingHorizontal: 14,
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
  searchButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  searchHelp: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  helpStaticCard: {
    backgroundColor: '#f4f7f2',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e9dd',
  },
  helpToggle: {
    paddingVertical: 4,
  },
  helpToggleText: {
    color: '#176b5f',
    fontSize: 13,
    fontWeight: '800',
  },
  helpStaticText: {
    fontSize: 13,
    color: '#41504d',
    marginTop: 8,
    lineHeight: 19,
  },
  helpDisclaimer: {
    fontWeight: '600',
    color: '#607174',
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
  continueLearningCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(216,177,90,0.35)',
    padding: 12,
    marginTop: 16,
  },
  continueLearningLabel: {
    color: '#d8b15a',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  continueLearningText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  continueLearningMeta: {
    color: '#d9e3df',
    fontSize: 13,
    lineHeight: 19,
  },
  resetLearnButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(216,177,90,0.45)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 12,
  },
  resetLearnButtonText: {
    color: '#f7f1df',
    fontSize: 12,
    fontWeight: '800',
  },
  dailyReviewCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(216,177,90,0.28)',
    padding: 12,
    marginTop: 14,
  },
  reviewStartButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#176b5f',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 12,
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
  learnCardLocked: {
    backgroundColor: '#f2f5f1',
    borderColor: '#d6ded4',
    opacity: 0.72,
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
  nawawiQuestionTitle: {
    color: '#132f35',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 8,
  },
  vocabularyItem: {
    borderWidth: 1,
    borderColor: '#d7dfd5',
    backgroundColor: '#f7faf7',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  vocabularyTerm: {
    color: '#176b5f',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
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
  learnActionButtonDisabled: {
    backgroundColor: '#aebdb8',
  },
  learnActionText: {
    color: '#fff',
    fontWeight: '800',
  },
  reviewCheckButton: {
    borderWidth: 1,
    borderColor: '#d7dfd5',
    backgroundColor: '#f7faf7',
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 13,
    marginTop: 6,
    marginBottom: 4,
  },
  reviewCheckButtonDone: {
    borderColor: '#176b5f',
    backgroundColor: '#edf4e8',
  },
  reviewCheckText: {
    color: '#41504d',
    fontSize: 15,
    fontWeight: '800',
  },
  reviewCheckTextDone: {
    color: '#176b5f',
  },
  lockedPathwayNotice: {
    color: '#607174',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 8,
  },
  secondaryTextButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  secondaryTextButtonText: {
    color: '#176b5f',
    fontSize: 14,
    fontWeight: '800',
  },
  arbainBackButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#176b5f',
    backgroundColor: '#eef6f2',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 13,
    marginTop: 12,
  },
  arbainBackButtonText: {
    color: '#0f5148',
    fontSize: 14,
    fontWeight: '900',
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
  settingsSectionTitle: {
    color: '#176b5f',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  settingsResetButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#b85c4d',
    backgroundColor: '#fff1ef',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 16,
  },
  settingsResetButtonText: {
    color: '#8a3a32',
    fontSize: 14,
    fontWeight: '900',
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
