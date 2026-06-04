import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
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
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { Share } from 'react-native';
import Markdown from 'react-native-markdown-display';
import AsyncStorage from '@react-native-async-storage/async-storage';

const lessons = require('./data/lessons.json');
const quizzes = require('./data/quizzes.json');
const arbainLearning = require('./data/arbainLearning.json');
const dailyQuizQuestions = require('./data/dailyQuizQuestions.json');
const bayquniyyahLearning = require('./data/bayquniyyahLearning.json');
const appConfig = require('./app.json');
const nawawiIntroCards = arbainLearning.introCards || [];
const nawawiPreview = arbainLearning.hadiths || [];
const bayquniyyahIntroCards = bayquniyyahLearning.introCards || [];
const bayquniyyahLessons = bayquniyyahLearning.lessons || [];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const { width, height } = Dimensions.get('window');

const APP_DOWNLOAD_LINK = `
Download the Takhrij App:
Android: https://bit.ly/4ei8UVT
iOS: Coming soon
`;

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://takhrij-backend.onrender.com';
const APP_VERSION = appConfig?.expo?.version || '1.0.0';
const DEFAULT_API_TIMEOUT_MS = 30000;
const NARRATOR_BIO_TIMEOUT_MS = 60000;
const LEARN_PROGRESS_STORAGE_KEY = 'takhrij.learnProgress';
const USER_PREFERENCES_STORAGE_KEY = 'takhrij.userPreferences';
const ONBOARDING_STORAGE_KEY = 'takhrij.hasSeenOnboarding';
const GUIDED_TOUR_STORAGE_KEY = 'takhrij.hasSeenGuidedTour';
const DAILY_REVIEW_REMINDER_HOUR = 20;
const DAILY_REVIEW_REMINDER_MINUTE = 0;
const TEXT_SIZE_OPTIONS = [
  { key: 'compact', label: 'Compact', scale: 0.94 },
  { key: 'comfortable', label: 'Comfortable', scale: 1 },
  { key: 'large', label: 'Large', scale: 1.12 },
];
const DEFAULT_USER_PREFERENCES = {
  textSize: 'comfortable',
  arabicTextSize: 'comfortable',
  dailyReviewReminderEnabled: false,
  dailyReviewNotificationId: '',
};
const DEFAULT_LEARN_PROGRESS = {
  completedLessons: {},
  quizAnswers: {},
  memorisation: {},
  mutunMemorisation: {},
  nawawiQuestionChecks: {},
  bayquniyyahCompletedLessons: {},
  bayquniyyahQuizAnswers: {},
  currentBayquniyyahLessonId: '',
  currentBayquniyyahCardIndex: 0,
  reviewSchedule: {},
  reviewStreak: { count: 0, lastReviewDate: '' },
  dailyQuizHistory: {
    date: '',
    questionIds: [],
    answers: {},
    completed: false,
    recentQuestionIds: [],
  },
};
const DEFAULT_DAILY_QUIZ_SESSION = {
  answered: 0,
  correct: 0,
  answers: [],
};
const ONBOARDING_SCREENS = [
  {
    title: 'Welcome to Takhrij',
    body: 'Takhrij helps you search, study, and revise hadith across 16 collections with over 50,000 narrations.',
  },
  {
    title: 'Search Hadith',
    body: 'Search by Arabic, English, or reference.',
    points: ['Bukhari 1', 'Sahih Muslim 300', 'Bulugh al-Maram 1', "Shama'il Muhammadiyah 1"],
  },
  {
    title: 'AI Commentary',
    body: 'Tap View AI Commentary for AI-generated educational support. Free users get 5 AI features per day. Always verify important religious matters with qualified teachers and reliable scholarly sources.',
  },
  {
    title: 'Narrator Biography',
    body: 'Tap narrator names to learn more about narrators. Narrator biographies are AI-generated and should be verified with reliable sources.',
  },
  {
    title: 'Learning Pathways',
    body: 'Study through structured pathways and track your progress as you learn.',
    points: ['Arbain Nawawi', 'Bayquniyyah', 'Daily Quiz'],
  },
  {
    title: 'Memorisation Mode',
    body: 'Use Memorise mode to revise with Arabic audio support.',
    points: ['Read', 'Repeat', 'Hide Words', 'Half Recall', 'Full Recall'],
  },
  {
    title: 'Sharing',
    body: 'Use the copy and share icons on hadith cards to share hadith without using AI quota.',
  },
];
const GUIDED_TOUR_STEPS = [
  {
    section: 'search',
    placement: 'top',
    label: 'Search Input',
    title: 'Search Hadith',
    body: 'Type Arabic, English, or a reference such as Bukhari 1 or Bulugh al-Maram 1.',
    pointer: '↓ Look here',
  },
  {
    section: 'search',
    placement: 'center',
    label: 'Search Tips and Disclaimer',
    title: 'Open Search Tips',
    body: 'Use this expandable section for search examples, collection notes, and the learning disclaimer.',
    pointer: '↓ Look here',
  },
  {
    section: 'search',
    placement: 'center',
    label: 'Search Result Card',
    title: 'Read Results',
    body: 'Hadith results appear as cards with reference, authenticity label when available, Arabic, and English text.',
    pointer: '↓ Look here',
  },
  {
    section: 'search',
    placement: 'upperMiddle',
    label: 'Copy and Share Icons',
    title: 'Copy or Share',
    body: 'Use the copy and share icons on a hadith card without using AI quota.',
    pointer: '↗ Look here',
  },
  {
    section: 'search',
    placement: 'bottom',
    label: 'View AI Commentary',
    title: 'AI Commentary',
    body: 'Tap View AI Commentary for educational support. This uses the daily AI feature limit.',
    pointer: '↓ Look here',
  },
  {
    section: 'learn',
    learnMode: 'overview',
    placement: 'top',
    label: 'Learn Section',
    title: 'Learning Pathways',
    body: 'Use Learn for Arbain Nawawi, Bayquniyyah, Daily Quiz, and progress tracking.',
    pointer: '↓ Look here',
  },
  {
    section: 'learn',
    learnMode: 'overview',
    placement: 'center',
    label: 'Arbain Nawawi Pathway',
    title: 'Arbain Nawawi',
    body: 'Open Arbain Nawawi to study foundational hadith with guided cards and memorisation tools.',
    pointer: '↓ Look here',
  },
  {
    section: 'learn',
    learnMode: 'overview',
    placement: 'center',
    label: 'Bayquniyyah Pathway',
    title: 'Bayquniyyah',
    body: 'Open Bayquniyyah to learn mustalah al-hadith terms through short poem lessons.',
    pointer: '↓ Look here',
  },
  {
    section: 'learn',
    learnMode: 'overview',
    placement: 'center',
    label: 'Daily Quiz',
    title: 'Daily Quiz',
    body: 'Daily Quiz gives active recall questions based on lessons you have completed.',
    pointer: '↓ Look here',
  },
  {
    section: 'learn',
    learnMode: 'nawawiHadith',
    placement: 'bottom',
    label: 'Memorise Button',
    title: 'Memorise Mode',
    body: 'Inside Arbain or Bayquniyyah lessons, tap Memorise to practise Read, Repeat, Hide Words, Half Recall, and Full Recall.',
    pointer: '↓ Look here',
  },
  {
    section: 'learn',
    learnMode: 'nawawiHadith',
    placement: 'upperMiddle',
    label: 'Arabic Speaker Icon',
    title: 'Arabic Audio',
    body: 'Use the speaker icon near Arabic text as a memorisation aid. Voice quality depends on your device.',
    pointer: '↘ Look here',
  },
];
const REVIEW_INTERVAL_DAYS = [1, 3, 7];
const MUTUN_MEMORISATION_STAGES = [
  'readComplete',
  'repeatComplete',
  'hideWordsComplete',
  'halfRecallComplete',
  'fullRecallComplete',
  'memorised',
];
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
const validBayquniyyahIds = new Set(bayquniyyahLessons.map(lesson => lesson.id));
const getTextScale = key => TEXT_SIZE_OPTIONS.find(option => option.key === key)?.scale || 1;
const sanitizeUserPreferences = preferences => ({
  textSize: TEXT_SIZE_OPTIONS.some(option => option.key === preferences?.textSize)
    ? preferences.textSize
    : DEFAULT_USER_PREFERENCES.textSize,
  arabicTextSize: TEXT_SIZE_OPTIONS.some(option => option.key === preferences?.arabicTextSize)
    ? preferences.arabicTextSize
    : DEFAULT_USER_PREFERENCES.arabicTextSize,
  dailyReviewReminderEnabled: preferences?.dailyReviewReminderEnabled === true,
  dailyReviewNotificationId: typeof preferences?.dailyReviewNotificationId === 'string'
    ? preferences.dailyReviewNotificationId
    : '',
});
const NAWAWI_SELECTION_TITLES = {
  'nawawi-1': 'Hadith 1: Actions Are by Intentions',
  'nawawi-2': 'Hadith 2: Islam, Iman, Ihsan',
  'nawawi-3': 'Hadith 3: The Pillars of Islam',
  'nawawi-4': 'Hadith 4: Creation in the Womb',
  'nawawi-5': 'Hadith 5: Rejected Innovations',
};

const getPathwayLessons = pathwayId => lessons.filter(lesson => lesson.pathway === pathwayId);
const getPathwayQuizzes = pathwayId => quizzes.filter(quiz => quiz.pathway === pathwayId);
const getPathwayCardCount = pathwayId => (
  (getPathwayLessons(pathwayId).length * 2) + getPathwayQuizzes(pathwayId).length
);
const getPathwayFlowCardCount = pathwayId => getPathwayCardCount(pathwayId) + 1;
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

const getMutunMemorisationKey = (source, id) => `${source}:${id}`;
const getMutunMemorisationTracker = (progress, source, id) =>
  progress?.mutunMemorisation?.[getMutunMemorisationKey(source, id)] || {};
const isMutunMemorised = (progress, source, id) =>
  !!getMutunMemorisationTracker(progress, source, id).memorised;
const splitArabicWords = text => String(text || '').trim().split(/\s+/).filter(Boolean);
const getHiddenWordsText = text => {
  const words = splitArabicWords(text);
  if (words.length < 4) return `${text || ''} ______`.trim();
  const hiddenIndexes = new Set();
  words.forEach((_, index) => {
    if (index >= 2 && index % 4 === 2) hiddenIndexes.add(index);
  });
  if (!hiddenIndexes.size) hiddenIndexes.add(Math.max(1, Math.floor(words.length / 2)));
  return words.map((word, index) => hiddenIndexes.has(index) ? '______' : word).join(' ');
};
const getHalfRecallText = text => {
  const words = splitArabicWords(text);
  if (words.length < 6) return getHiddenWordsText(text);
  const splitIndex = Math.max(2, Math.ceil(words.length / 2));
  return `${words.slice(0, splitIndex).join(' ')} ______`;
};

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

  const mutunMemorisation = {};
  Object.entries(source.mutunMemorisation || {}).forEach(([itemKey, tracker]) => {
    const validArbainKey = itemKey.startsWith('arbain:') && nawawiPreview.some(item => item.id === itemKey.replace('arbain:', ''));
    const validBayquniyyahKey = itemKey.startsWith('bayquniyyah:') && bayquniyyahLessons.some(item => item.id === itemKey.replace('bayquniyyah:', ''));
    if ((!validArbainKey && !validBayquniyyahKey) || !tracker || typeof tracker !== 'object') return;
    mutunMemorisation[itemKey] = {};
    MUTUN_MEMORISATION_STAGES.forEach(stage => {
      if (tracker[stage]) mutunMemorisation[itemKey][stage] = true;
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

  const bayquniyyahCompletedLessons = {};
  Object.entries(source.bayquniyyahCompletedLessons || {}).forEach(([lessonId, completed]) => {
    if (validBayquniyyahIds.has(lessonId) && completed) {
      bayquniyyahCompletedLessons[lessonId] = true;
    }
  });

  const bayquniyyahQuizAnswers = {};
  Object.entries(source.bayquniyyahQuizAnswers || {}).forEach(([lessonId, answer]) => {
    const lesson = bayquniyyahLessons.find(item => item.id === lessonId);
    if (!lesson || !answer || typeof answer !== 'object') return;
    const selectedOption = typeof answer.selectedOption === 'string' ? answer.selectedOption : '';
    const correctOption = lesson.quiz?.options?.[lesson.quiz.answerIndex] || '';
    if (selectedOption && correctOption) {
      bayquniyyahQuizAnswers[lessonId] = {
        selectedOption,
        correctOption,
        correct: selectedOption === correctOption,
      };
    }
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

  const validDailyQuizIds = new Set(dailyQuizQuestions.map(question => question.id));
  const rawDailyQuizHistory = source.dailyQuizHistory && typeof source.dailyQuizHistory === 'object'
    ? source.dailyQuizHistory
    : DEFAULT_LEARN_PROGRESS.dailyQuizHistory;
  const dailyQuizAnswers = {};
  Object.entries(rawDailyQuizHistory.answers || {}).forEach(([questionId, answer]) => {
    if (!validDailyQuizIds.has(questionId) || !answer || typeof answer !== 'object') return;
    dailyQuizAnswers[questionId] = {
      selectedAnswer: typeof answer.selectedAnswer === 'string' ? answer.selectedAnswer : '',
      correctAnswer: typeof answer.correctAnswer === 'string' ? answer.correctAnswer : '',
      correct: answer.correct === true,
    };
  });
  const dailyQuizHistory = {
    date: typeof rawDailyQuizHistory.date === 'string' ? rawDailyQuizHistory.date : '',
    questionIds: Array.isArray(rawDailyQuizHistory.questionIds)
      ? rawDailyQuizHistory.questionIds.filter(questionId => validDailyQuizIds.has(questionId)).slice(0, 3)
      : [],
    answers: dailyQuizAnswers,
    completed: rawDailyQuizHistory.completed === true,
    recentQuestionIds: Array.isArray(rawDailyQuizHistory.recentQuestionIds)
      ? rawDailyQuizHistory.recentQuestionIds.filter(questionId => validDailyQuizIds.has(questionId)).slice(-12)
      : [],
  };

  const currentPathwayId = validPathwayIds.has(source.currentPathwayId)
    ? source.currentPathwayId
    : 'beginner';
  const pathwayCardCount = getPathwayFlowCardCount(currentPathwayId);

  return {
    ...DEFAULT_LEARN_PROGRESS,
    ...source,
    completedLessons,
    quizAnswers,
    memorisation,
    mutunMemorisation,
    nawawiQuestionChecks,
    bayquniyyahCompletedLessons,
    bayquniyyahQuizAnswers,
    reviewSchedule,
    reviewStreak,
    dailyQuizHistory,
    currentPathwayId,
    currentPathwayCardIndex: clampLearningIndex(source.currentPathwayCardIndex, pathwayCardCount || 1),
    currentNawawiCardIndex: clampLearningIndex(source.currentNawawiCardIndex, getNawawiCards().length || 1),
    currentBayquniyyahLessonId: validBayquniyyahIds.has(source.currentBayquniyyahLessonId)
      ? source.currentBayquniyyahLessonId
      : bayquniyyahLessons[0]?.id || '',
    currentBayquniyyahCardIndex: clampLearningIndex(source.currentBayquniyyahCardIndex, 5),
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

const normalizeQuizAnswer = value =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const isNawawiHadithComplete = (hadith, progress) => {
  const tracker = progress.memorisation?.[hadith.id] || {};
  return (hadith.stages || []).length > 0 && hadith.stages.every(stage => tracker[stage]);
};

const isArbainPathwayComplete = progress => (
  nawawiPreview.length > 0 && nawawiPreview.every(hadith => isNawawiHadithComplete(hadith, progress))
);

const getCompletedArbainCount = progress => (
  nawawiPreview.filter(hadith => isNawawiHadithComplete(hadith, progress)).length
);

const getCompletedBayquniyyahCount = progress => (
  bayquniyyahLessons.filter(lesson => !!progress.bayquniyyahCompletedLessons?.[lesson.id]).length
);

const isBayquniyyahComplete = progress => (
  bayquniyyahLessons.length > 0 && bayquniyyahLessons.every(lesson => !!progress.bayquniyyahCompletedLessons?.[lesson.id])
);

const getBayquniyyahLessonIndex = lessonId => bayquniyyahLessons.findIndex(lesson => lesson.id === lessonId);

const isBayquniyyahLessonUnlocked = (lessonId, progress) => {
  const lessonIndex = getBayquniyyahLessonIndex(lessonId);
  if (lessonIndex <= 0) return lessonIndex === 0;
  const previousLesson = bayquniyyahLessons[lessonIndex - 1];
  return !!progress.bayquniyyahCompletedLessons?.[previousLesson?.id];
};

const getCompletedLearningIds = progress => {
  const completedIds = new Set();
  lessons.forEach(lesson => {
    if (progress.completedLessons?.[lesson.id]) completedIds.add(lesson.id);
  });
  nawawiPreview.forEach(hadith => {
    if (isNawawiHadithComplete(hadith, progress)) completedIds.add(hadith.id);
  });
  return completedIds;
};

const getEligibleDailyQuizQuestions = progress => {
  const completedIds = getCompletedLearningIds(progress);
  return dailyQuizQuestions.filter(question => completedIds.has(question.lessonId));
};

const selectDailyQuizQuestions = (progress, todayKey = getTodayKey()) => {
  const eligibleQuestions = getEligibleDailyQuizQuestions(progress);
  const todayHistory = progress.dailyQuizHistory?.date === todayKey
    ? progress.dailyQuizHistory
    : null;
  if (todayHistory?.questionIds?.length) {
    return todayHistory.questionIds
      .map(questionId => eligibleQuestions.find(question => question.id === questionId))
      .filter(Boolean)
      .slice(0, 3);
  }

  const recentIds = new Set(progress.dailyQuizHistory?.recentQuestionIds || []);
  const rankedQuestions = eligibleQuestions
    .map(question => ({
      question,
      rank: getStableHash(`${todayKey}:${question.id}`),
      recentlyUsed: recentIds.has(question.id),
    }))
    .sort((a, b) => Number(a.recentlyUsed) - Number(b.recentlyUsed) || a.rank - b.rank)
    .map(item => item.question);
  return rankedQuestions.slice(0, 3);
};

const getDailyQuizStreakCount = getCurrentReviewStreakCount;

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
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [onboardingIndex, setOnboardingIndex] = useState(0);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(true);
  const [guidedTourVisible, setGuidedTourVisible] = useState(false);
  const [guidedTourIndex, setGuidedTourIndex] = useState(0);
  const [hasSeenGuidedTour, setHasSeenGuidedTour] = useState(true);
  const [activeSection, setActiveSection] = useState('search');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [learnProgress, setLearnProgress] = useState(DEFAULT_LEARN_PROGRESS);
  const learnProgressRef = useRef(DEFAULT_LEARN_PROGRESS);
  const [learnMode, setLearnMode] = useState('overview');
  const [selectedPathwayId, setSelectedPathwayId] = useState('beginner');
  const [activePathwayPreviewIndex, setActivePathwayPreviewIndex] = useState(0);
  const [activePathwayCardIndex, setActivePathwayCardIndex] = useState(0);
  const [selectedNawawiHadithId, setSelectedNawawiHadithId] = useState(nawawiPreview[0]?.id || '');
  const [activeNawawiCardIndex, setActiveNawawiCardIndex] = useState(0);
  const [selectedBayquniyyahLessonId, setSelectedBayquniyyahLessonId] = useState(bayquniyyahLessons[0]?.id || '');
  const [activeBayquniyyahCardIndex, setActiveBayquniyyahCardIndex] = useState(0);
  const [memorisationSource, setMemorisationSource] = useState('arbain');
  const [memorisationItemId, setMemorisationItemId] = useState(nawawiPreview[0]?.id || '');
  const [activeMemorisationStepIndex, setActiveMemorisationStepIndex] = useState(0);
  const [memorisationRepeatChecks, setMemorisationRepeatChecks] = useState({});
  const [memorisationReveal, setMemorisationReveal] = useState(false);
  const [memorisationRemembered, setMemorisationRemembered] = useState(false);
  const [speakingTextKey, setSpeakingTextKey] = useState('');
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [activeReviewCards, setActiveReviewCards] = useState([]);
  const [reviewSessionSummary, setReviewSessionSummary] = useState(DEFAULT_DAILY_QUIZ_SESSION);
  const [dailyQuizInput, setDailyQuizInput] = useState('');
  const [showSearchHelp, setShowSearchHelp] = useState(false);
  const [loadingCommentary, setLoadingCommentary] = useState(false);
  const [commentaryModalVisible, setCommentaryModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [userPreferences, setUserPreferences] = useState(DEFAULT_USER_PREFERENCES);
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
const textScale = getTextScale(userPreferences.textSize);
const arabicTextScale = getTextScale(userPreferences.arabicTextSize);
const scaledTextStyle = fontSize => ({ fontSize: Math.round(fontSize * textScale) });
const scaledArabicTextStyle = fontSize => ({ fontSize: Math.round(fontSize * arabicTextScale) });

  const stopArabicSpeech = async () => {
    try {
      await Speech.stop();
    } catch {
      // Speech availability depends on the device; stopping should never block learning.
    } finally {
      setSpeakingTextKey('');
    }
  };

  const speakArabicText = async (text, textKey) => {
    const cleanText = String(text || '').trim();
    if (!cleanText) return;
    try {
      const isSpeaking = await Speech.isSpeakingAsync();
      if (isSpeaking) {
        await Speech.stop();
        if (speakingTextKey === textKey) {
          setSpeakingTextKey('');
          return;
        }
      }
      setSpeakingTextKey(textKey);
      Speech.speak(cleanText, {
        language: 'ar',
        rate: 0.82,
        onDone: () => setSpeakingTextKey(currentKey => currentKey === textKey ? '' : currentKey),
        onStopped: () => setSpeakingTextKey(currentKey => currentKey === textKey ? '' : currentKey),
        onError: () => {
          setSpeakingTextKey(currentKey => currentKey === textKey ? '' : currentKey);
          Alert.alert('Arabic voice unavailable', 'Arabic voice may depend on your device settings.');
        },
      });
    } catch {
      setSpeakingTextKey('');
      Alert.alert('Arabic voice unavailable', 'Arabic voice may depend on your device settings.');
    }
  };

  const renderArabicSpeakerButton = (text, textKey, label = 'Play Arabic') => (
    <Pressable
      style={styles.arabicSpeakerButton}
      onPress={() => speakArabicText(text, textKey)}
      accessibilityRole="button"
      accessibilityLabel={speakingTextKey === textKey ? 'Stop Arabic audio' : label}
    >
      <Ionicons name={speakingTextKey === textKey ? 'stop-circle-outline' : 'volume-high-outline'} size={18} color="#176b5f" />
      <Text style={styles.arabicSpeakerText}>{speakingTextKey === textKey ? 'Stop' : label}</Text>
    </Pressable>
  );

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
    if (activeSection !== 'learn') {
      stopArabicSpeech();
    }
  }, [activeSection]);

  useEffect(() => {
    if (!['nawawiHadith', 'bayquniyyahLesson', 'mutunMemorisation'].includes(learnMode)) {
      stopArabicSpeech();
    }
  }, [learnMode]);

  useEffect(() => () => {
    Speech.stop();
  }, []);

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
  }, [learnMode, activePathwayCardIndex, selectedNawawiHadithId, activeNawawiCardIndex, activeBayquniyyahCardIndex, activeReviewIndex, activeMemorisationStepIndex, memorisationItemId, cardFadeAnim, cardSlideAnim]);

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
      const totalCards = getPathwayFlowCardCount(selectedPathwayId);
      animateProgressTo(totalCards ? ((activePathwayCardIndex + 1) / totalCards) * 100 : 0);
    } else if (learnMode === 'nawawiHadith') {
      const selectedHadith = nawawiPreview.find(hadith => hadith.id === selectedNawawiHadithId);
      const includesCompletionCard = selectedHadith?.id === nawawiPreview[nawawiPreview.length - 1]?.id
        && isArbainPathwayComplete(sanitizeLearnProgress(learnProgressRef.current || DEFAULT_LEARN_PROGRESS));
      const totalCards = getNawawiCards(selectedNawawiHadithId).length + (includesCompletionCard ? 1 : 0);
      animateProgressTo(totalCards ? ((activeNawawiCardIndex + 1) / totalCards) * 100 : 0);
    } else if (learnMode === 'review') {
      const totalCards = activeReviewCards.length;
      animateProgressTo(totalCards ? ((activeReviewIndex + 1) / totalCards) * 100 : 0);
    } else if (learnMode === 'bayquniyyahLesson') {
      animateProgressTo(((activeBayquniyyahCardIndex + 1) / 5) * 100);
    } else if (learnMode === 'mutunMemorisation') {
      animateProgressTo(((activeMemorisationStepIndex + 1) / 6) * 100);
    } else {
      progressAnim.setValue(0);
    }
  }, [learnMode, selectedPathwayId, activePathwayCardIndex, selectedNawawiHadithId, activeNawawiCardIndex, activeBayquniyyahCardIndex, activeReviewIndex, activeReviewCards.length, activeMemorisationStepIndex, progressAnim]);

  useEffect(() => {
    const loadLocalProgress = async () => {
      try {
        const [storedProgress, storedPreferences, storedOnboarding, storedGuidedTour] = await Promise.all([
          AsyncStorage.getItem(LEARN_PROGRESS_STORAGE_KEY),
          AsyncStorage.getItem(USER_PREFERENCES_STORAGE_KEY),
          AsyncStorage.getItem(ONBOARDING_STORAGE_KEY),
          AsyncStorage.getItem(GUIDED_TOUR_STORAGE_KEY),
        ]);
        setHasSeenOnboarding(storedOnboarding === 'true');
        setHasSeenGuidedTour(storedGuidedTour === 'true');
        try {
          const parsedProgress = storedProgress ? JSON.parse(storedProgress) : DEFAULT_LEARN_PROGRESS;
          const safeProgress = sanitizeLearnProgress(parsedProgress);
          learnProgressRef.current = safeProgress;
          setLearnProgress(safeProgress);
          persistLearnProgress(safeProgress);
          setSelectedPathwayId(safeProgress.currentPathwayId);
          const pathwayCardCount = getPathwayFlowCardCount(safeProgress.currentPathwayId);
          setActivePathwayCardIndex(clampLearningIndex(safeProgress.currentPathwayCardIndex, pathwayCardCount || 1));
          setActiveNawawiCardIndex(clampLearningIndex(safeProgress.currentNawawiCardIndex, getNawawiCards().length || 1));
          setSelectedBayquniyyahLessonId(safeProgress.currentBayquniyyahLessonId || bayquniyyahLessons[0]?.id || '');
          setActiveBayquniyyahCardIndex(clampLearningIndex(safeProgress.currentBayquniyyahCardIndex, 5));
        } catch {
          learnProgressRef.current = DEFAULT_LEARN_PROGRESS;
          setLearnProgress(DEFAULT_LEARN_PROGRESS);
        }
        try {
          const parsedPreferences = storedPreferences ? JSON.parse(storedPreferences) : DEFAULT_USER_PREFERENCES;
          setUserPreferences(sanitizeUserPreferences(parsedPreferences));
        } catch {
          setUserPreferences(DEFAULT_USER_PREFERENCES);
        }
      } catch {
        learnProgressRef.current = DEFAULT_LEARN_PROGRESS;
        setLearnProgress(DEFAULT_LEARN_PROGRESS);
        setUserPreferences(DEFAULT_USER_PREFERENCES);
        setHasSeenOnboarding(false);
        setHasSeenGuidedTour(false);
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

  const updateUserPreference = async (key, value) => {
    const nextPreferences = sanitizeUserPreferences({
      ...userPreferences,
      [key]: value,
    });
    setUserPreferences(nextPreferences);
    try {
      await AsyncStorage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(nextPreferences));
    } catch {
      // Preferences are local polish only; storage errors should not block the app.
    }
  };

  const saveUserPreferences = async nextPreferences => {
    const safePreferences = sanitizeUserPreferences(nextPreferences);
    setUserPreferences(safePreferences);
    try {
      await AsyncStorage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(safePreferences));
    } catch {
      // Preferences are local polish only; storage errors should not block the app.
    }
  };

  const openOnboarding = () => {
    setOnboardingIndex(0);
    setOnboardingVisible(true);
  };

  const applyGuidedTourStep = stepIndex => {
    const step = GUIDED_TOUR_STEPS[stepIndex] || GUIDED_TOUR_STEPS[0];
    if (!step) return;
    setActiveSection(step.section || 'search');
    if (step.section === 'learn') {
      setLearnMode(step.learnMode || 'overview');
      if (step.learnMode === 'nawawiHadith') {
        setSelectedNawawiHadithId(nawawiPreview[0]?.id || '');
        setActiveNawawiCardIndex(0);
      }
    }
    if (step.section === 'search' && step.label === 'Search Tips and Disclaimer') {
      setShowSearchHelp(true);
    }
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 120);
  };

  const openGuidedTour = () => {
    setSettingsVisible(false);
    setShowWelcome(false);
    setGuidedTourIndex(0);
    setGuidedTourVisible(true);
    applyGuidedTourStep(0);
  };

  const finishGuidedTour = async () => {
    setGuidedTourVisible(false);
    setGuidedTourIndex(0);
    setHasSeenGuidedTour(true);
    try {
      await AsyncStorage.setItem(GUIDED_TOUR_STORAGE_KEY, 'true');
    } catch {
      // Tour state is helpful, but storage errors should not block the app.
    }
  };

  const resetTutorialState = () => {
    Alert.alert(
      'Reset tutorial state?',
      'This will show the first-time tutorial and guided tour again. Your learning progress will not be changed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                ONBOARDING_STORAGE_KEY,
                GUIDED_TOUR_STORAGE_KEY,
              ]);
            } catch {
              // Reset is only for testing/replay; storage errors should not interrupt app use.
            }
            setHasSeenOnboarding(false);
            setHasSeenGuidedTour(false);
            setOnboardingIndex(0);
            setGuidedTourIndex(0);
            setOnboardingVisible(false);
            setGuidedTourVisible(false);
            Alert.alert('Tutorial reset', 'Restart the app to see the first-time tutorial again.');
          },
        },
      ]
    );
  };

  const finishOnboarding = async () => {
    setOnboardingVisible(false);
    setOnboardingIndex(0);
    setHasSeenOnboarding(true);
    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch {
      // Onboarding should never block the app if local storage is unavailable.
    }
  };

  const dismissWelcome = () => {
    setShowWelcome(false);
    if (!hasSeenOnboarding) {
      openOnboarding();
    }
  };

  const cancelDailyReviewReminder = async (
    notificationId = userPreferences.dailyReviewNotificationId
  ) => {
    if (!notificationId) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      // If the notification no longer exists, the preference can still be updated safely.
    }
  };

  const scheduleDailyReviewReminder = async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily-review', {
        name: 'Daily Review',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existingPermission = await Notifications.getPermissionsAsync();
    let finalStatus = existingPermission.status;
    if (finalStatus !== 'granted') {
      const requestedPermission = await Notifications.requestPermissionsAsync();
      finalStatus = requestedPermission.status;
    }

    if (finalStatus !== 'granted') {
      await cancelDailyReviewReminder();
      await saveUserPreferences({
        ...userPreferences,
        dailyReviewReminderEnabled: false,
        dailyReviewNotificationId: '',
      });
      Alert.alert(
        'Notifications disabled',
        'Daily Review reminders are off because notification permission was not granted.'
      );
      return;
    }

    await cancelDailyReviewReminder();
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time for your Daily Review',
        body: "Revise your lessons and complete today's quiz.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        channelId: Platform.OS === 'android' ? 'daily-review' : undefined,
        hour: DAILY_REVIEW_REMINDER_HOUR,
        minute: DAILY_REVIEW_REMINDER_MINUTE,
      },
    });
    await saveUserPreferences({
      ...userPreferences,
      dailyReviewReminderEnabled: true,
      dailyReviewNotificationId: notificationId,
    });
  };

  const toggleDailyReviewReminder = async () => {
    if (userPreferences.dailyReviewReminderEnabled) {
      await cancelDailyReviewReminder();
      await saveUserPreferences({
        ...userPreferences,
        dailyReviewReminderEnabled: false,
        dailyReviewNotificationId: '',
      });
      return;
    }
    try {
      await scheduleDailyReviewReminder();
    } catch {
      await saveUserPreferences({
        ...userPreferences,
        dailyReviewReminderEnabled: false,
        dailyReviewNotificationId: '',
      });
      Alert.alert('Reminder unavailable', 'Daily Review reminders could not be scheduled on this device.');
    }
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

  const markMutunMemorisationStage = (source, id, stage, value = true) => {
    if (!MUTUN_MEMORISATION_STAGES.includes(stage)) return;
    const itemKey = getMutunMemorisationKey(source, id);
    updateLearnProgress(previousProgress => {
      const currentTracker = previousProgress.mutunMemorisation?.[itemKey] || {};
      return {
        ...previousProgress,
        mutunMemorisation: {
          ...previousProgress.mutunMemorisation,
          [itemKey]: {
            ...currentTracker,
            [stage]: value,
          },
        },
      };
    });
  };

  const openMutunMemorisation = (source, id) => {
    setMemorisationSource(source);
    setMemorisationItemId(id);
    setActiveMemorisationStepIndex(0);
    setMemorisationRepeatChecks({});
    setMemorisationReveal(false);
    setMemorisationRemembered(false);
    stopArabicSpeech();
    setLearnMode('mutunMemorisation');
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
      'This clears lesson completion, quiz attempts, pathway position, and Arbain checklist progress. App settings will not be changed.',
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
            setSelectedBayquniyyahLessonId(bayquniyyahLessons[0]?.id || '');
            setActiveBayquniyyahCardIndex(0);
            setActiveReviewIndex(0);
            setActiveReviewCards([]);
            setReviewSessionSummary(DEFAULT_DAILY_QUIZ_SESSION);
            setDailyQuizInput('');
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

  useEffect(() => {
    if (learnMode !== 'bayquniyyahLesson') return;
    const currentProgress = learnProgressRef.current || DEFAULT_LEARN_PROGRESS;
    if (
      currentProgress.currentBayquniyyahLessonId === selectedBayquniyyahLessonId &&
      currentProgress.currentBayquniyyahCardIndex === activeBayquniyyahCardIndex
    ) {
      return;
    }
    const nextProgress = sanitizeLearnProgress({
      ...currentProgress,
      currentBayquniyyahLessonId: selectedBayquniyyahLessonId,
      currentBayquniyyahCardIndex: activeBayquniyyahCardIndex,
    });
    learnProgressRef.current = nextProgress;
    setLearnProgress(nextProgress);
    persistLearnProgress(nextProgress);
  }, [learnMode, selectedBayquniyyahLessonId, activeBayquniyyahCardIndex]);

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
    setLoading(true);
    setResult('');
    try {
      const data = await postJson('/search-hadith', { query: q });
      setResult(data.result || formatStructuredSearchResults(data.results) || '');
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

  const buildHadithShareText = ({
    reference,
    arabic,
    english,
    authenticityStatus,
    commentary = '',
    chain = '',
    includeDownloadLink = true,
  }) => {
    const sections = [
      `Hadith Reference: ${reference}`,
      `Arabic Matn:\n${arabic}`,
      `English Matn:\n${english}`,
      `Authenticity Status:\n${authenticityStatus || 'Not specified in source'}`,
    ];

    if (commentary?.trim()) {
      sections.push(`Commentary:\n${commentary.trim()}`);
    }
    if (chain?.trim()) {
      sections.push(`Chain of Narrators:\n${chain.trim()}`);
    }
    if (includeDownloadLink) {
      sections.push(APP_DOWNLOAD_LINK.trim());
    }

    return sections.join('\n\n');
  };

  const copyHadith = async hadith => {
    const textToCopy = buildHadithShareText({
      reference: hadith.reference || '',
      arabic: hadith.arabic || '',
      english: hadith.english || '',
      authenticityStatus: hadith.authenticityStatus || '',
      includeDownloadLink: false,
    });
    await Clipboard.setStringAsync(textToCopy);
  };

  const shareHadith = async hadith => {
    const textToShare = buildHadithShareText({
      reference: hadith.reference || '',
      arabic: hadith.arabic || '',
      english: hadith.english || '',
      authenticityStatus: hadith.authenticityStatus || '',
    });
    await Share.share({ message: textToShare });
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

      if (guidedTourVisible) {
        finishGuidedTour();
        return true;
      }

      if (onboardingVisible) {
        finishOnboarding();
        return true;
      }

      if (settingsVisible) {
        setSettingsVisible(false);
        return true;
      }

      if (activeSection === 'learn' && learnMode === 'mutunMemorisation') {
        stopArabicSpeech();
        setLearnMode(memorisationSource === 'arbain' ? 'nawawiHadith' : 'bayquniyyahLesson');
        return true;
      }

      if (activeSection === 'learn' && learnMode === 'nawawiHadith') {
        setLearnMode('nawawi');
        return true;
      }

      if (activeSection === 'learn' && learnMode === 'bayquniyyahLesson') {
        setLearnMode('bayquniyyah');
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
    guidedTourVisible,
    hasSearchOutput,
    activeSection,
    learnMode,
    loadingCommentary,
    memorisationSource,
    narratorBioVisible,
    onboardingVisible,
    settingsVisible,
    thankYouVisible,
  ]);

  const premiumFeatures = [
    'Remaining Arbain Nawawi Hadith',
    'Bulugh al-Maram memorisation',
    'Riyadh al-Salihin memorisation',
    'Top 100 Hadith Narrator Biographies',
    "Jarh wa Ta'dil learning pathway"
  ];

  const openPathway = (pathwayId, options = {}) => {
    const savedProgress = sanitizeLearnProgress(learnProgressRef.current || DEFAULT_LEARN_PROGRESS);
    const lockMessage = getPathwayLockMessage(pathwayId, savedProgress);
    if (lockMessage) return;
    const pathwayCardCount = getPathwayFlowCardCount(pathwayId);
    setSelectedPathwayId(pathwayId);
    setActivePathwayCardIndex(
      options.revise
        ? 0
        : savedProgress.currentPathwayId === pathwayId
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

  const openBayquniyyahLesson = (lessonId, options = {}) => {
    const savedProgress = sanitizeLearnProgress(learnProgressRef.current || DEFAULT_LEARN_PROGRESS);
    if (!isBayquniyyahLessonUnlocked(lessonId, savedProgress)) return;
    setSelectedBayquniyyahLessonId(lessonId);
    setActiveBayquniyyahCardIndex(
      options.revise
        ? 0
        : savedProgress.currentBayquniyyahLessonId === lessonId
          ? clampLearningIndex(savedProgress.currentBayquniyyahCardIndex, 5)
          : 0
    );
    setLearnMode('bayquniyyahLesson');
  };

  const markBayquniyyahLessonComplete = lessonId => {
    updateLearnProgress(previousProgress => ({
      ...previousProgress,
      currentBayquniyyahLessonId: lessonId,
      currentBayquniyyahCardIndex: activeBayquniyyahCardIndex,
      bayquniyyahCompletedLessons: {
        ...previousProgress.bayquniyyahCompletedLessons,
        [lessonId]: true,
      },
    }));
  };

  const answerBayquniyyahQuiz = (lessonId, selectedOption) => {
    const lesson = bayquniyyahLessons.find(item => item.id === lessonId);
    const correctOption = lesson?.quiz?.options?.[lesson.quiz.answerIndex] || '';
    updateLearnProgress(previousProgress => ({
      ...previousProgress,
      currentBayquniyyahLessonId: lessonId,
      currentBayquniyyahCardIndex: activeBayquniyyahCardIndex,
      bayquniyyahQuizAnswers: {
        ...previousProgress.bayquniyyahQuizAnswers,
        [lessonId]: {
          selectedOption,
          correctOption,
          correct: selectedOption === correctOption,
        },
      },
    }));
  };

  const openReviewFlow = () => {
    const safeProgress = sanitizeLearnProgress(learnProgressRef.current || DEFAULT_LEARN_PROGRESS);
    const today = getTodayKey();
    const dailyQuizCards = selectDailyQuizQuestions(safeProgress, today);
    setActiveReviewCards(dailyQuizCards);
    setActiveReviewIndex(0);
    setReviewSessionSummary(DEFAULT_DAILY_QUIZ_SESSION);
    setDailyQuizInput('');
    if (dailyQuizCards.length) {
      updateLearnProgress(previousProgress => ({
        ...previousProgress,
        dailyQuizHistory: {
          ...(previousProgress.dailyQuizHistory || DEFAULT_LEARN_PROGRESS.dailyQuizHistory),
          date: today,
          questionIds: dailyQuizCards.map(question => question.id),
          answers: previousProgress.dailyQuizHistory?.date === today
            ? previousProgress.dailyQuizHistory.answers || {}
            : {},
          completed: previousProgress.dailyQuizHistory?.date === today
            ? previousProgress.dailyQuizHistory.completed === true
            : false,
        },
      }));
    }
    setLearnMode('review');
  };

  const saveDailyQuizAnswer = (question, selectedAnswer, isLastQuestion) => {
    const correct = normalizeQuizAnswer(selectedAnswer) === normalizeQuizAnswer(question.answer);
    const today = getTodayKey();
    const nextAnsweredCount = reviewSessionSummary.answered + 1;
    const nextCorrectCount = reviewSessionSummary.correct + (correct ? 1 : 0);
    const passedDailyQuiz = isLastQuestion && activeReviewCards.length > 0 && nextCorrectCount === activeReviewCards.length;
    updateLearnProgress(previousProgress => {
      const previousHistory = previousProgress.dailyQuizHistory || DEFAULT_LEARN_PROGRESS.dailyQuizHistory;
      const lastReviewDate = previousProgress.reviewStreak?.lastReviewDate || '';
      let streakCount = previousProgress.reviewStreak?.count || 0;
      if (passedDailyQuiz && lastReviewDate !== today) {
        streakCount = lastReviewDate === addDaysToDateKey(today, -1)
          ? streakCount + 1
          : 1;
      }
      return {
        ...previousProgress,
        dailyQuizHistory: {
          ...previousHistory,
          date: today,
          questionIds: activeReviewCards.map(card => card.id),
          answers: {
            ...(previousHistory.date === today ? previousHistory.answers : {}),
            [question.id]: {
              selectedAnswer,
              correctAnswer: question.answer,
              correct,
            },
          },
          completed: passedDailyQuiz,
          recentQuestionIds: [
            ...new Set([
              ...(previousHistory.recentQuestionIds || []),
              ...activeReviewCards.map(card => card.id),
            ]),
          ].slice(-12),
        },
        reviewStreak: passedDailyQuiz
          ? {
              count: streakCount,
              lastReviewDate: today,
            }
          : previousProgress.reviewStreak,
      };
    });
    setReviewSessionSummary(previousSummary => ({
      answered: nextAnsweredCount,
      correct: nextCorrectCount,
      answers: [
        ...(previousSummary.answers || []),
        { questionId: question.id, correct },
      ],
    }));
    setDailyQuizInput('');
    setActiveReviewIndex(index => index + 1);
  };

  const handleDailyQuizAnswer = selectedAnswer => {
    const question = activeReviewCards[activeReviewIndex];
    if (!question || !String(selectedAnswer || '').trim()) return;
    saveDailyQuizAnswer(question, String(selectedAnswer).trim(), activeReviewIndex >= activeReviewCards.length - 1);
  };

  const retryDailyQuiz = () => {
    setActiveReviewIndex(0);
    setReviewSessionSummary(DEFAULT_DAILY_QUIZ_SESSION);
    setDailyQuizInput('');
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
        const isCompleted = isPathwayComplete(pathway.id, safeProgress);

        return (
          <Pressable
            style={[
              styles.learnCard,
              isCompleted && styles.learnCardCompleted,
              isLocked && styles.learnCardLocked,
            ]}
            onPress={() => openPathway(pathway.id, { revise: isCompleted })}
            disabled={isLocked}
          >
            <View style={styles.learnCardHeader}>
              <Text style={styles.lessonLevel}>{pathway.range}</Text>
              <Text style={isCompleted ? styles.completedStatusBadge : styles.completedBadge}>
                {isCompleted ? '✓ Completed' : `${activePathwayPreviewIndex + 1}/${LEARNING_PATHWAYS.length}`}
              </Text>
            </View>
            <Text style={styles.lessonTitle}>{pathway.title}</Text>
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>{pathway.description}</Text>
            <Text style={[styles.lessonPoint, scaledTextStyle(15)]}>
              Progress: {completedCount}/{pathwayLessons.length} lessons • {progress}%
            </Text>
            <Text style={styles.flowHint}>Study one card at a time, then try the pathway quiz.</Text>
            {isLocked && <Text style={styles.lockedPathwayNotice}>{lockMessage}</Text>}
            <View style={[
              styles.learnActionButton,
              isCompleted && styles.learnActionButtonCompleted,
              isLocked && styles.learnActionButtonDisabled,
            ]}>
              <Text style={styles.learnActionText}>
                {isLocked ? 'Locked' : isCompleted ? 'Revise Again' : hasStarted ? 'Continue Pathway' : 'Start Pathway'}
              </Text>
            </View>
          </Pressable>
        );
      })()}
      <View style={styles.flowControls}>
        {activePathwayPreviewIndex > 0 && (
          <Pressable
            style={styles.flowButton}
            onPress={() => setActivePathwayPreviewIndex(index => Math.max(0, index - 1))}
          >
            <View style={styles.flowButtonContent}>
              <Text style={styles.flowButtonChevron}>{'\u2039'}</Text>
              <Text style={styles.flowButtonText}>{activePathwayPreviewIndex === 1 ? 'Back to Basics' : 'Back to Intermediate'}</Text>
            </View>
          </Pressable>
        )}
        {activePathwayPreviewIndex < LEARNING_PATHWAYS.length - 1 && (
          <Pressable
            style={styles.flowButton}
            onPress={() => setActivePathwayPreviewIndex(index => Math.min(LEARNING_PATHWAYS.length - 1, index + 1))}
          >
            <View style={styles.flowButtonContent}>
              <Text style={styles.flowButtonText}>{activePathwayPreviewIndex === 0 ? 'Continue to Intermediate' : 'Continue to Advanced'}</Text>
              <Text style={styles.flowButtonChevron}>{'\u203a'}</Text>
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );

  const renderNawawiOverview = () => {
    const safeProgress = sanitizeLearnProgress(learnProgress);
    const arbainComplete = isArbainPathwayComplete(safeProgress);
    return (
    <View>
      <Pressable style={[styles.learnCard, arbainComplete && styles.learnCardCompleted]} onPress={openNawawiItem}>
        <View style={styles.learnCardHeader}>
          <Text style={styles.lessonLevel}>Guided memorisation</Text>
          <Text style={arbainComplete ? styles.completedStatusBadge : styles.completedBadge}>
            {arbainComplete ? '✓ Completed' : '5 hadith'}
          </Text>
        </View>
        <Text style={styles.lessonTitle}>Arbain Nawawi Learning Path</Text>
        <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>Study and memorise the first 5 hadith through short guided cards.</Text>
        <Text style={[styles.lessonPoint, scaledTextStyle(15)]}>Includes introduction cards, full matn, key vocabulary, lessons, memorisation chunks, active recall, and review checkpoints.</Text>
        <View style={[styles.learnActionButton, arbainComplete && styles.learnActionButtonCompleted]}>
          <Text style={styles.learnActionText}>
            {arbainComplete ? 'Revise Again' : learnProgress.currentNawawiCardIndex ? 'Continue Arbain Nawawi' : 'Explore Arbain Nawawi'}
          </Text>
        </View>
      </Pressable>
    </View>
    );
  };

  const renderBayquniyyahOverview = () => {
    const safeProgress = sanitizeLearnProgress(learnProgress);
    const completedCount = getCompletedBayquniyyahCount(safeProgress);
    const bayquniyyahComplete = isBayquniyyahComplete(safeProgress);
    return (
      <View>
        <Pressable
          style={[styles.learnCard, bayquniyyahComplete && styles.learnCardCompleted]}
          onPress={() => setLearnMode('bayquniyyah')}
        >
          <View style={styles.learnCardHeader}>
            <Text style={styles.lessonLevel}>Free pathway</Text>
            <Text style={bayquniyyahComplete ? styles.completedStatusBadge : styles.completedBadge}>
              {bayquniyyahComplete ? '✓ Completed' : `${completedCount}/34`}
            </Text>
          </View>
          <Text style={styles.lessonTitle}>Bayquniyyah</Text>
          <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>
            Learn mustalah al-hadith through the famous beginner poem, one term at a time.
          </Text>
          <Text style={styles.completionProgressText}>Progress: {completedCount} / 34 Lessons Completed</Text>
          {renderStaticProgressBar((completedCount / 34) * 100)}
          <View style={[styles.learnActionButton, bayquniyyahComplete && styles.learnActionButtonCompleted]}>
            <Text style={styles.learnActionText}>{bayquniyyahComplete ? 'Revise Again' : completedCount ? 'Continue Bayquniyyah' : 'Start Bayquniyyah'}</Text>
          </View>
        </Pressable>
      </View>
    );
  };

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

  const renderStaticProgressBar = percentage => (
    <View style={styles.flowProgressTrack}>
      <View style={[styles.flowProgressFill, { width: `${Math.min(Math.max(percentage || 0, 0), 100)}%` }]} />
    </View>
  );

  const renderCompletionIcon = () => (
    <Ionicons
      name="checkmark-circle"
      size={82}
      color="#176b5f"
      style={styles.completionIconVector}
      accessibilityLabel="Completed"
    />
  );

  const renderNawawiPage = () => {
    const introCards = nawawiIntroCards;
    const safeProgress = sanitizeLearnProgress(learnProgress);
    const arbainComplete = isArbainPathwayComplete(safeProgress);
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
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>{card.body}</Text>
          </View>
        ))}

        {arbainComplete && (
          <View style={[styles.learnCard, styles.learnCardCompleted]}>
            <View style={styles.pathwayCompletionPanel}>
              {renderCompletionIcon()}
              <Text style={styles.lessonCompletionTitle}>Alhamdulillah!</Text>
              <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>
                You have completed the Arbain Nawawi Pathway.
              </Text>
              <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>
                May Allah increase you in beneficial knowledge and steadfastness upon the Sunnah.
              </Text>
              <View style={styles.completionActionRow}>
                <Pressable style={styles.lessonCompletionButton} onPress={() => setLearnMode('overview')}>
                  <Text style={styles.lessonCompletionButtonText}>Return to Home</Text>
                </Pressable>
                <Pressable
                  style={[styles.lessonCompletionButton, styles.learnActionButtonCompleted]}
                  onPress={() => openNawawiHadith(nawawiPreview[0]?.id)}
                >
                  <Text style={styles.lessonCompletionButtonText}>Revise Again</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.learnSectionTitle}>Choose a Hadith</Text>
        {nawawiPreview.map((hadith, index) => {
          const tracker = learnProgress.memorisation?.[hadith.id] || {};
          const completedStages = (hadith.stages || []).filter(stage => tracker[stage]).length;
          const hadithComplete = isNawawiHadithComplete(hadith, safeProgress);
          const hadithMemorised = isMutunMemorised(safeProgress, 'arbain', hadith.id);
          return (
            <Pressable
              key={hadith.id}
              style={[styles.learnCard, hadithComplete && styles.learnCardCompleted]}
              onPress={() => openNawawiHadith(hadith.id)}
            >
              <View style={styles.learnCardHeader}>
                <Text style={styles.lessonLevel}>Hadith {index + 1}</Text>
                <Text style={hadithComplete ? styles.completedStatusBadge : styles.completedBadge}>
                  {hadithComplete ? '✓ Completed' : `${completedStages}/${hadith.stages.length} checkpoints`}
                </Text>
              </View>
              {hadithMemorised && <Text style={styles.memorisedBadge}>Memorised</Text>}
              <Text style={styles.lessonTitle}>{NAWAWI_SELECTION_TITLES[hadith.id] || hadith.title}</Text>
              <Text style={styles.nawawiReference}>{hadith.reference}</Text>
              <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>{hadith.english}</Text>
              <View style={[styles.learnActionButton, hadithComplete && styles.learnActionButtonCompleted]}>
                <Text style={styles.learnActionText}>{hadithComplete ? 'Revise Again' : completedStages ? 'Continue Hadith' : 'Start Hadith'}</Text>
              </View>
            </Pressable>
          );
        })}
      </>
    );
  };

  const renderBayquniyyahPage = () => {
    const safeProgress = sanitizeLearnProgress(learnProgress);
    const completedCount = getCompletedBayquniyyahCount(safeProgress);
    const bayquniyyahComplete = isBayquniyyahComplete(safeProgress);
    return (
      <>
        <View style={styles.learnHeroCard}>
          <Text style={styles.learnEyebrow}>Mustalah al-hadith poem</Text>
          <Text style={styles.learnTitle}>Bayquniyyah</Text>
          <Text style={styles.learnIntro}>Study 34 concise lines that introduce essential hadith terminology.</Text>
          <Pressable style={styles.arbainBackButton} onPress={() => setLearnMode('overview')}>
            <Text style={styles.arbainBackButtonText}>Back to Learn</Text>
          </Pressable>
        </View>

        <Text style={styles.learnSectionTitle}>Before You Begin</Text>
        {bayquniyyahIntroCards.map(card => (
          <View key={card.id} style={styles.learnCard}>
            <Text style={styles.lessonLevel}>Introduction</Text>
            <Text style={styles.lessonTitle}>{card.title}</Text>
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>{card.body}</Text>
          </View>
        ))}

        <View style={styles.learnCard}>
          <Text style={styles.lessonLevel}>Bayquniyyah Progress</Text>
          <Text style={styles.lessonTitle}>{completedCount} / 34 Lessons Completed</Text>
          {renderStaticProgressBar((completedCount / 34) * 100)}
        </View>

        {bayquniyyahComplete && (
          <View style={[styles.learnCard, styles.learnCardCompleted]}>
            <View style={styles.pathwayCompletionPanel}>
              {renderCompletionIcon()}
              <Text style={styles.lessonCompletionTitle}>Alhamdulillah!</Text>
              <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>
                You have completed the Bayquniyyah Pathway.
              </Text>
              <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>
                May Allah increase you in beneficial knowledge and grant you understanding of the sciences of hadith.
              </Text>
              <Text style={styles.completionProgressText}>Progress: {completedCount} / 34 Lessons Completed</Text>
              {renderStaticProgressBar(100)}
              <View style={styles.completionActionRow}>
                <Pressable style={styles.lessonCompletionButton} onPress={() => setLearnMode('overview')}>
                  <Text style={styles.lessonCompletionButtonText}>Return Home</Text>
                </Pressable>
                <Pressable
                  style={[styles.lessonCompletionButton, styles.learnActionButtonCompleted]}
                  onPress={() => openBayquniyyahLesson(bayquniyyahLessons[0]?.id, { revise: true })}
                >
                  <Text style={styles.lessonCompletionButtonText}>Revise Again</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.learnSectionTitle}>Choose a Lesson</Text>
        {bayquniyyahLessons.map(lesson => {
          const completed = !!safeProgress.bayquniyyahCompletedLessons?.[lesson.id];
          const unlocked = isBayquniyyahLessonUnlocked(lesson.id, safeProgress);
          const lessonMemorised = isMutunMemorised(safeProgress, 'bayquniyyah', lesson.id);
          return (
            <Pressable
              key={lesson.id}
              style={[
                styles.learnCard,
                completed && styles.learnCardCompleted,
                !unlocked && styles.learnCardLocked,
              ]}
              onPress={() => openBayquniyyahLesson(lesson.id, { revise: completed })}
              disabled={!unlocked}
            >
              <View style={styles.learnCardHeader}>
                <Text style={styles.lessonLevel}>Lesson {lesson.number}</Text>
                <Text style={completed ? styles.completedStatusBadge : styles.completedBadge}>
                  {completed ? '✓ Completed' : unlocked ? lesson.keyTerm : 'Locked'}
                </Text>
              </View>
              {lessonMemorised && <Text style={styles.memorisedBadge}>Memorised</Text>}
              <Text style={styles.lessonTitle}>{lesson.title}</Text>
              <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>{lesson.explanation}</Text>
              {!unlocked && (
                <View style={styles.lockedLessonNoticeRow}>
                  <Ionicons name="lock-closed" size={15} color="#607174" style={styles.lockedLessonIcon} />
                  <Text style={styles.lockedLessonNoticeText}>
                    Complete the previous lesson to unlock
                  </Text>
                </View>
              )}
              <View style={[
                styles.learnActionButton,
                completed && styles.learnActionButtonCompleted,
                !unlocked && styles.learnActionButtonDisabled,
              ]}>
                <Text style={styles.learnActionText}>{!unlocked ? 'Locked' : completed ? 'Revise Again' : 'Start Lesson'}</Text>
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
    const contentCardCount = getPathwayCardCount(pathway.id);
    const totalCards = getPathwayFlowCardCount(pathway.id);
    const lessonCardCount = pathwayLessons.length * 2;
    const isPathwayCompletionCard = activePathwayCardIndex >= contentCardCount;
    const isQuizCard = !isPathwayCompletionCard && activePathwayCardIndex >= lessonCardCount;
    const lessonIndex = isQuizCard ? -1 : Math.floor(activePathwayCardIndex / 2);
    const isLessonCompletionCard = !isQuizCard && activePathwayCardIndex % 2 === 1;
    const lesson = !isQuizCard ? pathwayLessons[lessonIndex] : null;
    const quiz = isQuizCard ? pathwayQuizzes[activePathwayCardIndex - lessonCardCount] : null;
    const progress = totalCards ? Math.min(100, ((activePathwayCardIndex + 1) / totalCards) * 100) : 0;

    if (!contentCardCount) {
      return (
        <View style={styles.learnCard}>
          <Text style={styles.lessonTitle}>Pathway unavailable</Text>
          <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>Please return to Learn and try another pathway.</Text>
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
        {isPathwayCompletionCard && (
          <View style={styles.pathwayCompletionPanel}>
            {renderCompletionIcon()}
            <Text style={styles.lessonCompletionTitle}>Alhamdulillah!</Text>
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>
              You have completed the {pathway.title}.
            </Text>
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>
              May Allah increase you in beneficial knowledge and steadfastness upon the Sunnah.
            </Text>
            <Pressable style={styles.lessonCompletionButton} onPress={() => setLearnMode('overview')}>
              <Text style={styles.lessonCompletionButtonText}>Return to Home</Text>
            </Pressable>
          </View>
        )}
        {!isQuizCard && lesson && !isLessonCompletionCard && (
          <>
            <Text style={styles.lessonTitle}>{lesson.title}</Text>
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>{lesson.summary}</Text>
            {lesson.points.map(point => (
              <Text key={point} style={[styles.lessonPoint, scaledTextStyle(15)]}>• {point}</Text>
            ))}
            <Text style={styles.flowHint}>Continue to the completion card when you are ready to save this lesson.</Text>
          </>
        )}
        {!isQuizCard && lesson && isLessonCompletionCard && (
          <View style={styles.lessonCompletionPanel}>
            <Text style={styles.lessonCompletionEyebrow}>Lesson {lessonIndex + 1}</Text>
            <Text style={styles.lessonCompletionTitle}>Lesson Complete</Text>
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>You have reached the end of this lesson.</Text>
            <Pressable
              style={[styles.lessonCompletionButton, learnProgress.completedLessons?.[lesson.id] && styles.learnActionButtonSecondary]}
              onPress={() => markLessonComplete(lesson.id)}
              disabled={!!learnProgress.completedLessons?.[lesson.id]}
            >
              <Text style={styles.lessonCompletionButtonText}>
                {learnProgress.completedLessons?.[lesson.id] ? 'Completed' : '✓ Mark Complete'}
              </Text>
            </Pressable>
            <Text style={styles.flowHint}>
              {learnProgress.completedLessons?.[lesson.id]
                ? 'Saved. This lesson can now appear in Daily Quiz.'
                : 'Marking complete saves your progress and unlocks Daily Quiz questions.'}
            </Text>
          </View>
        )}
        {isQuizCard && quiz && (
          <>
            <Text style={styles.quizTitle}>{quiz.title}</Text>
            <Text style={[styles.quizQuestion, scaledTextStyle(17)]}>{quiz.question}</Text>
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
                  <Text style={[styles.quizOptionText, scaledTextStyle(15)]}>{option}</Text>
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
        {!isPathwayCompletionCard && (
          <View style={styles.flowControls}>
          <Pressable
            style={[styles.flowButton, activePathwayCardIndex === 0 && styles.flowButtonDisabled]}
            disabled={activePathwayCardIndex === 0}
            onPress={() => setActivePathwayCardIndex(index => Math.max(0, index - 1))}
          >
            <Text style={styles.flowButtonText}>Back</Text>
          </Pressable>
          <Pressable
            style={[styles.flowButton, activePathwayCardIndex === totalCards - 1 && styles.flowButtonDisabled]}
            disabled={activePathwayCardIndex === totalCards - 1}
            onPress={() => setActivePathwayCardIndex(index => Math.min(totalCards - 1, index + 1))}
          >
            <Text style={styles.flowButtonText}>Continue</Text>
          </Pressable>
          </View>
        )}
        <Pressable style={styles.secondaryTextButton} onPress={() => setLearnMode('overview')}>
          <Text style={styles.secondaryTextButtonText}>Back to pathways</Text>
        </Pressable>
      </Animated.View>
    );
  };

  const renderNawawiFlow = () => {
    const selectedHadith = nawawiPreview.find(hadith => hadith.id === selectedNawawiHadithId) || nawawiPreview[0];
    const nawawiCards = getNawawiCards(selectedHadith?.id);
    const safeProgress = sanitizeLearnProgress(learnProgress);
    const selectedHadithIndex = Math.max(0, nawawiPreview.findIndex(hadith => hadith.id === selectedHadith?.id));
    const selectedHadithNumber = selectedHadithIndex + 1;
    const selectedHadithComplete = selectedHadith ? isNawawiHadithComplete(selectedHadith, safeProgress) : false;
    const completedArbainCount = getCompletedArbainCount(safeProgress);
    const nextNawawiHadith = nawawiPreview[selectedHadithIndex + 1];
    const isFinalNawawiHadith = selectedHadith?.id === nawawiPreview[nawawiPreview.length - 1]?.id;
    const showArbainCompletionCard = isFinalNawawiHadith && isArbainPathwayComplete(safeProgress);
    const showHadithCompletionCard = selectedHadithComplete;
    const hadithCompletionCardIndex = nawawiCards.length;
    const fullCompletionCardIndex = hadithCompletionCardIndex + (showHadithCompletionCard ? 1 : 0);
    const totalCards = nawawiCards.length + (showHadithCompletionCard ? 1 : 0) + (showArbainCompletionCard ? 1 : 0);
    const isHadithCompletionCard = showHadithCompletionCard && activeNawawiCardIndex === hadithCompletionCardIndex;
    const isArbainCompletionCard = showArbainCompletionCard && activeNawawiCardIndex >= fullCompletionCardIndex;
    const card = nawawiCards[activeNawawiCardIndex] || nawawiCards[0];
    if (!card && !isHadithCompletionCard && !isArbainCompletionCard) return null;
    const { hadith } = card || {};
    const tracker = hadith ? learnProgress.memorisation?.[hadith.id] || {} : {};
    const questionChecks = hadith ? learnProgress.nawawiQuestionChecks?.[hadith.id] || {} : {};
    const rawQuestionCheck = card ? questionChecks[card.questionIndex] : false;
    const questionReviewed = rawQuestionCheck || false;
    const progress = totalCards ? Math.min(100, ((activeNawawiCardIndex + 1) / totalCards) * 100) : 0;
    const cardLabel = isArbainCompletionCard
      ? 'Complete'
      : isHadithCompletionCard
        ? 'Hadith Complete'
      : card.type === 'intro'
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
        {isArbainCompletionCard ? (
          <View style={styles.pathwayCompletionPanel}>
            {renderCompletionIcon()}
            <Text style={styles.lessonCompletionTitle}>Alhamdulillah!</Text>
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>
              You have completed the Arbain Nawawi Pathway.
            </Text>
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>
              May Allah increase you in beneficial knowledge and steadfastness upon the Sunnah.
            </Text>
            <View style={styles.completionActionRow}>
              <Pressable style={styles.lessonCompletionButton} onPress={() => setLearnMode('overview')}>
                <Text style={styles.lessonCompletionButtonText}>Return to Home</Text>
              </Pressable>
              <Pressable
                style={[styles.lessonCompletionButton, styles.learnActionButtonCompleted]}
                onPress={() => {
                  setActiveNawawiCardIndex(0);
                  setLearnMode('nawawiHadith');
                }}
              >
                <Text style={styles.lessonCompletionButtonText}>Revise Again</Text>
              </Pressable>
            </View>
          </View>
        ) : isHadithCompletionCard ? (
          <View style={styles.pathwayCompletionPanel}>
            {renderCompletionIcon()}
            <Text style={styles.lessonCompletionTitle}>Alhamdulillah!</Text>
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>
              You have completed Hadith {selectedHadithNumber} of Arbain Nawawi.
            </Text>
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>
              May Allah increase you in beneficial knowledge and grant you success in acting upon it.
            </Text>
            <Text style={styles.completionProgressText}>
              Progress: {completedArbainCount} / 40 Hadith Completed
            </Text>
            {renderStaticProgressBar((completedArbainCount / 40) * 100)}
            <View style={styles.completionActionRow}>
              <Pressable style={styles.lessonCompletionButton} onPress={() => setLearnMode('nawawi')}>
                <Text style={styles.lessonCompletionButtonText}>Continue to Arbain</Text>
              </Pressable>
              <Pressable
                style={[styles.lessonCompletionButton, styles.learnActionButtonCompleted]}
                onPress={() => setActiveNawawiCardIndex(0)}
              >
                <Text style={styles.lessonCompletionButtonText}>Revise Again</Text>
              </Pressable>
              {nextNawawiHadith && (
                <Pressable
                  style={styles.lessonCompletionButton}
                  onPress={() => openNawawiHadith(nextNawawiHadith.id)}
                >
                  <Text style={styles.lessonCompletionButtonText}>Next Hadith</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : card.type === 'intro' ? (
          <>
            <Text style={styles.lessonTitle}>{card.card.title}</Text>
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>{card.card.body}</Text>
          </>
        ) : card.type === 'hadith' ? (
          <>
            <Text style={styles.lessonTitle}>{hadith.title}</Text>
            <Text style={styles.nawawiReference}>{hadith.reference}</Text>
            <Text style={styles.nawawiReference}>Narrator: {hadith.narrator}</Text>
            <Text style={[styles.nawawiArabic, scaledArabicTextStyle(22)]}>{hadith.arabic}</Text>
            {renderArabicSpeakerButton(hadith.arabic, `arbain:${hadith.id}:full`, 'Play Arabic')}
            <Pressable
              style={styles.memoriseModeButton}
              onPress={() => openMutunMemorisation('arbain', hadith.id)}
            >
              <Ionicons name="school-outline" size={17} color="#176b5f" />
              <Text style={styles.memoriseModeButtonText}>Memorise</Text>
            </Pressable>
            <Text style={styles.flowHint}>Read the full matn slowly before practicing smaller chunks.</Text>
          </>
        ) : card.type === 'meaning' ? (
          <>
            <Text style={styles.lessonTitle}>{hadith.title}</Text>
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>{hadith.english}</Text>
            <Text style={styles.flowHint}>This is a simple learning meaning, not a detailed translation commentary.</Text>
          </>
        ) : card.type === 'vocabulary' ? (
          <>
            <Text style={styles.lessonTitle}>{hadith.title}</Text>
            {(hadith.vocabulary || []).map(item => (
              <View key={item.term} style={styles.vocabularyItem}>
                <Text style={styles.vocabularyTerm}>{item.term}</Text>
                <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>{item.meaning}</Text>
              </View>
            ))}
          </>
        ) : card.type === 'lessons' ? (
          <>
            <Text style={styles.lessonTitle}>{hadith.title}</Text>
            {(hadith.lessons || []).map(point => (
              <Text key={point} style={[styles.lessonPoint, scaledTextStyle(15)]}>• {point}</Text>
            ))}
          </>
        ) : card.type === 'chunk' ? (
          <>
            <Text style={styles.lessonTitle}>{hadith.title}</Text>
            <Text style={styles.nawawiQuestionTitle}>Read this chunk aloud</Text>
            <Text style={[styles.nawawiArabic, scaledArabicTextStyle(22)]}>{card.chunk}</Text>
            {renderArabicSpeakerButton(card.chunk, `arbain:${hadith.id}:chunk:${card.chunkIndex}`, 'Play Arabic')}
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>Cover the screen after reading, then try to recite this phrase from memory.</Text>
          </>
        ) : card.type === 'reflection' ? (
          <>
            <Text style={styles.lessonTitle}>{hadith.title}</Text>
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>{hadith.reflection}</Text>
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
                <Text style={[styles.quizQuestion, scaledTextStyle(17)]}>{card.question}</Text>
                <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>Pause and answer in your own words before moving on.</Text>
                <Pressable
                  style={[styles.learnActionButton, questionReviewed && styles.learnActionButtonSecondary]}
                  onPress={() => toggleNawawiQuestionCheck(hadith.id, card.questionIndex)}
                >
                  <Text style={styles.learnActionText}>{questionReviewed ? 'Self Check Completed' : 'Mark Self Check'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.quizQuestion, scaledTextStyle(17)]}>{card.question.prompt}</Text>
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
                      <Text style={[styles.quizOptionText, scaledTextStyle(15)]}>{option}</Text>
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
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>This card is not available.</Text>
          </>
        )}
        {!isArbainCompletionCard && !isHadithCompletionCard && (
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
        )}
        <Pressable style={styles.secondaryTextButton} onPress={() => setLearnMode('nawawi')}>
          <Text style={styles.secondaryTextButtonText}>Back to Arbain</Text>
        </Pressable>
      </Animated.View>
    );
  };

  const renderBayquniyyahFlow = () => {
    const safeProgress = sanitizeLearnProgress(learnProgress);
    const lesson = bayquniyyahLessons.find(item => item.id === selectedBayquniyyahLessonId) || bayquniyyahLessons[0];
    if (!lesson) return null;
    const lessonIndex = Math.max(0, bayquniyyahLessons.findIndex(item => item.id === lesson.id));
    const nextLesson = bayquniyyahLessons[lessonIndex + 1];
    const completed = !!safeProgress.bayquniyyahCompletedLessons?.[lesson.id];
    const completedCount = getCompletedBayquniyyahCount(safeProgress);
    const quizAnswer = safeProgress.bayquniyyahQuizAnswers?.[lesson.id];
    const cardLabel = activeBayquniyyahCardIndex === 0
      ? 'Arabic Line'
      : activeBayquniyyahCardIndex === 1
        ? 'Meaning'
        : activeBayquniyyahCardIndex === 2
          ? 'Memorisation'
          : activeBayquniyyahCardIndex === 3
            ? 'Mini Quiz'
            : 'Lesson Complete';

    return (
      <Animated.View style={[styles.learnCard, styles.flowCard, { opacity: cardFadeAnim, transform: [{ translateY: cardSlideAnim }] }]}>
        <View style={styles.learnCardHeader}>
          <Text style={styles.lessonLevel}>Bayquniyyah • {cardLabel}</Text>
          <Text style={styles.completedBadge}>{activeBayquniyyahCardIndex + 1}/5</Text>
        </View>
        {renderAnimatedProgressBar()}

        {activeBayquniyyahCardIndex === 0 && (
          <>
            <Text style={styles.lessonTitle}>Lesson {lesson.number}: {lesson.title}</Text>
            <Text style={[styles.nawawiArabic, scaledArabicTextStyle(22)]}>{lesson.arabic}</Text>
            {renderArabicSpeakerButton(lesson.arabic, `bayquniyyah:${lesson.id}:line`, 'Play Arabic')}
            <Pressable
              style={styles.memoriseModeButton}
              onPress={() => openMutunMemorisation('bayquniyyah', lesson.id)}
            >
              <Ionicons name="school-outline" size={17} color="#176b5f" />
              <Text style={styles.memoriseModeButtonText}>Memorise</Text>
            </Pressable>
            <Text style={styles.flowHint}>Read the Arabic slowly before moving to the meaning.</Text>
          </>
        )}

        {activeBayquniyyahCardIndex === 1 && (
          <>
            <Text style={styles.lessonTitle}>{lesson.keyTerm}</Text>
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>{lesson.english}</Text>
            <View style={styles.vocabularyItem}>
              <Text style={styles.vocabularyTerm}>Beginner explanation</Text>
              <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>{lesson.explanation}</Text>
            </View>
          </>
        )}

        {activeBayquniyyahCardIndex === 2 && (
          <>
            <Text style={styles.lessonTitle}>Memorise Gradually</Text>
            <Text style={styles.nawawiQuestionTitle}>Missing word practice</Text>
            <Text style={[styles.quizQuestion, scaledTextStyle(17)]}>{lesson.memorisePrompt.prompt}</Text>
            {renderArabicSpeakerButton(lesson.arabic, `bayquniyyah:${lesson.id}:practice`, 'Play Arabic')}
            <View style={styles.vocabularyItem}>
              <Text style={styles.vocabularyTerm}>Answer</Text>
              <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>{lesson.memorisePrompt.answer}</Text>
            </View>
            <Text style={styles.flowHint}>Cover the answer and recite the line again from memory.</Text>
          </>
        )}

        {activeBayquniyyahCardIndex === 3 && (
          <>
            <Text style={styles.quizTitle}>Mini Quiz</Text>
            <Text style={[styles.quizQuestion, scaledTextStyle(17)]}>{lesson.quiz.question}</Text>
            {getShuffledOptions(lesson.quiz.options, lesson.id).map(option => {
              const correctOption = lesson.quiz.options[lesson.quiz.answerIndex];
              const selected = quizAnswer?.selectedOption === option;
              const correctOptionSelected = quizAnswer && option === correctOption;
              const selectedWrong = selected && quizAnswer && !quizAnswer.correct;
              return (
                <Pressable
                  key={option}
                  style={[
                    styles.quizOption,
                    selected && styles.quizOptionSelected,
                    selectedWrong && styles.quizOptionWrong,
                    correctOptionSelected && styles.quizOptionCorrect,
                  ]}
                  onPress={() => answerBayquniyyahQuiz(lesson.id, option)}
                >
                  <Text style={[styles.quizOptionText, scaledTextStyle(15)]}>{option}</Text>
                </Pressable>
              );
            })}
            <Text style={styles.flowHint}>{quizAnswer ? 'Answer saved. Continue to complete the lesson.' : 'Choose an answer before completing the lesson.'}</Text>
          </>
        )}

        {activeBayquniyyahCardIndex === 4 && (
          <View style={styles.pathwayCompletionPanel}>
            {renderCompletionIcon()}
            <Text style={styles.lessonCompletionTitle}>Alhamdulillah!</Text>
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>
              You have completed Lesson {lesson.number} of Bayquniyyah.
            </Text>
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>
              May Allah increase you in beneficial knowledge and make the sciences of hadith easy for you.
            </Text>
            <Text style={styles.completionProgressText}>
              Progress: {completedCount} / 34 Lessons Completed
            </Text>
            {renderStaticProgressBar((completedCount / 34) * 100)}
            {!completed && (
              <Pressable style={styles.lessonCompletionButton} onPress={() => markBayquniyyahLessonComplete(lesson.id)}>
                <Text style={styles.lessonCompletionButtonText}>Mark Complete</Text>
              </Pressable>
            )}
            {completed && (
              <View style={styles.completionActionRow}>
                <Pressable style={styles.lessonCompletionButton} onPress={() => setLearnMode('bayquniyyah')}>
                  <Text style={styles.lessonCompletionButtonText}>Continue to Bayquniyyah</Text>
                </Pressable>
                <Pressable
                  style={[styles.lessonCompletionButton, styles.learnActionButtonCompleted]}
                  onPress={() => setActiveBayquniyyahCardIndex(0)}
                >
                  <Text style={styles.lessonCompletionButtonText}>Revise Again</Text>
                </Pressable>
                {nextLesson && (
                  <Pressable
                    style={styles.lessonCompletionButton}
                    onPress={() => openBayquniyyahLesson(nextLesson.id)}
                  >
                    <Text style={styles.lessonCompletionButtonText}>Next Lesson</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}

        {activeBayquniyyahCardIndex < 4 && (
          <View style={styles.flowControls}>
            <Pressable
              style={[styles.flowButton, activeBayquniyyahCardIndex === 0 && styles.flowButtonDisabled]}
              disabled={activeBayquniyyahCardIndex === 0}
              onPress={() => setActiveBayquniyyahCardIndex(index => Math.max(0, index - 1))}
            >
              <Text style={styles.flowButtonText}>Back</Text>
            </Pressable>
            <Pressable
              style={styles.flowButton}
              onPress={() => setActiveBayquniyyahCardIndex(index => Math.min(4, index + 1))}
            >
              <Text style={styles.flowButtonText}>Continue</Text>
            </Pressable>
          </View>
        )}
        <Pressable style={styles.secondaryTextButton} onPress={() => setLearnMode('bayquniyyah')}>
          <Text style={styles.secondaryTextButtonText}>Back to Bayquniyyah</Text>
        </Pressable>
      </Animated.View>
    );
  };

  const renderMutunMemorisationFlow = () => {
    const safeProgress = sanitizeLearnProgress(learnProgress);
    const isArbain = memorisationSource === 'arbain';
    const item = isArbain
      ? nawawiPreview.find(hadith => hadith.id === memorisationItemId)
      : bayquniyyahLessons.find(lesson => lesson.id === memorisationItemId);
    if (!item) return null;

    const itemNumber = isArbain
      ? Math.max(1, nawawiPreview.findIndex(hadith => hadith.id === item.id) + 1)
      : item.number;
    const sourceTitle = isArbain ? 'Arbain Nawawi' : 'Bayquniyyah';
    const returnMode = isArbain ? 'nawawiHadith' : 'bayquniyyahLesson';
    const itemTitle = isArbain ? item.title : `Lesson ${item.number}: ${item.title}`;
    const arabicText = item.arabic || '';
    const tracker = getMutunMemorisationTracker(safeProgress, memorisationSource, item.id);
    const hiddenWordsText = getHiddenWordsText(arabicText);
    const halfRecallText = isArbain && item.chunks?.[0]
      ? `${item.chunks[0]} ______`
      : getHalfRecallText(arabicText);
    const repeatComplete = [1, 2, 3].every(repeat => memorisationRepeatChecks[repeat]);
    const stepTitles = ['Read', 'Repeat', 'Hide Words', 'Half Recall', 'Full Recall', 'Result'];
    const progress = ((activeMemorisationStepIndex + 1) / stepTitles.length) * 100;

    const goToNextStep = (stage = '') => {
      if (stage) markMutunMemorisationStage(memorisationSource, item.id, stage, true);
      setMemorisationReveal(false);
      setActiveMemorisationStepIndex(index => Math.min(stepTitles.length - 1, index + 1));
    };

    const toggleRepeat = repeatNumber => {
      const nextChecks = {
        ...memorisationRepeatChecks,
        [repeatNumber]: !memorisationRepeatChecks[repeatNumber],
      };
      setMemorisationRepeatChecks(nextChecks);
      if ([1, 2, 3].every(repeat => nextChecks[repeat])) {
        markMutunMemorisationStage(memorisationSource, item.id, 'repeatComplete', true);
      }
    };

    const finishFullRecall = remembered => {
      markMutunMemorisationStage(memorisationSource, item.id, 'fullRecallComplete', true);
      markMutunMemorisationStage(memorisationSource, item.id, 'memorised', remembered);
      setMemorisationRemembered(remembered);
      setMemorisationReveal(false);
      setActiveMemorisationStepIndex(5);
    };

    return (
      <Animated.View style={[styles.learnCard, styles.flowCard, { opacity: cardFadeAnim, transform: [{ translateY: cardSlideAnim }] }]}>
        <View style={styles.learnCardHeader}>
          <Text style={styles.lessonLevel}>{sourceTitle} • Memorise</Text>
          <Text style={styles.completedBadge}>{activeMemorisationStepIndex + 1}/{stepTitles.length}</Text>
        </View>
        {renderStaticProgressBar(progress)}
        <Text style={styles.lessonTitle}>{stepTitles[activeMemorisationStepIndex]}</Text>
        <Text style={styles.nawawiReference}>{itemTitle}</Text>

        {activeMemorisationStepIndex === 0 && (
          <>
            <Text style={[styles.nawawiArabic, scaledArabicTextStyle(22)]}>{arabicText}</Text>
            {renderArabicSpeakerButton(arabicText, `mutun:${memorisationSource}:${item.id}:read`, 'Play Arabic')}
            <Text style={styles.flowHint}>Read the text carefully. This is a memorisation aid, not Qur'an recitation. Arabic voice quality depends on your device settings.</Text>
            <Pressable style={styles.lessonCompletionButton} onPress={() => goToNextStep('readComplete')}>
              <Text style={styles.lessonCompletionButtonText}>Continue</Text>
            </Pressable>
          </>
        )}

        {activeMemorisationStepIndex === 1 && (
          <>
            <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>Repeat the Arabic text three times. Mark each repeat after you recite it.</Text>
            {renderArabicSpeakerButton(arabicText, `mutun:${memorisationSource}:${item.id}:repeat`, 'Play Arabic')}
            <View style={styles.memorisationGrid}>
              {[1, 2, 3].map(repeat => {
                const done = !!memorisationRepeatChecks[repeat];
                return (
                  <Pressable
                    key={repeat}
                    style={[styles.memorisationStep, done && styles.memorisationStepDone]}
                    onPress={() => toggleRepeat(repeat)}
                  >
                    <Text style={[styles.memorisationStepText, done && styles.memorisationStepTextDone]}>
                      Repeat {repeat}{done ? ' done' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={[styles.lessonCompletionButton, !repeatComplete && styles.flowButtonDisabled]}
              disabled={!repeatComplete}
              onPress={() => goToNextStep('repeatComplete')}
            >
              <Text style={styles.lessonCompletionButtonText}>Continue</Text>
            </Pressable>
          </>
        )}

        {activeMemorisationStepIndex === 2 && (
          <>
            <Text style={styles.nawawiQuestionTitle}>Hide Words</Text>
            <Text style={[styles.nawawiArabic, scaledArabicTextStyle(22)]}>{memorisationReveal ? arabicText : hiddenWordsText}</Text>
            <Text style={styles.flowHint}>Try to complete the hidden words from memory before revealing.</Text>
            <View style={styles.flowControls}>
              <Pressable style={styles.flowButton} onPress={() => setMemorisationReveal(reveal => !reveal)}>
                <Text style={styles.flowButtonText}>{memorisationReveal ? 'Hide Again' : 'Reveal'}</Text>
              </Pressable>
              <Pressable style={styles.flowButton} onPress={() => goToNextStep('hideWordsComplete')}>
                <Text style={styles.flowButtonText}>Continue</Text>
              </Pressable>
            </View>
          </>
        )}

        {activeMemorisationStepIndex === 3 && (
          <>
            <Text style={styles.nawawiQuestionTitle}>Half Recall</Text>
            <Text style={[styles.nawawiArabic, scaledArabicTextStyle(22)]}>{memorisationReveal ? arabicText : halfRecallText}</Text>
            <Text style={styles.flowHint}>Read the visible part, then recite the rest before revealing.</Text>
            <View style={styles.flowControls}>
              <Pressable style={styles.flowButton} onPress={() => setMemorisationReveal(reveal => !reveal)}>
                <Text style={styles.flowButtonText}>{memorisationReveal ? 'Hide Again' : 'Reveal'}</Text>
              </Pressable>
              <Pressable style={styles.flowButton} onPress={() => goToNextStep('halfRecallComplete')}>
                <Text style={styles.flowButtonText}>Continue</Text>
              </Pressable>
            </View>
          </>
        )}

        {activeMemorisationStepIndex === 4 && (
          <>
            <Text style={styles.nawawiQuestionTitle}>Full Recall</Text>
            {memorisationReveal ? (
              <Text style={[styles.nawawiArabic, scaledArabicTextStyle(22)]}>{arabicText}</Text>
            ) : (
              <View style={styles.recallHiddenPanel}>
                <Text style={styles.recallHiddenText}>Recite from memory before revealing.</Text>
              </View>
            )}
            <View style={styles.flowControls}>
              <Pressable style={styles.flowButton} onPress={() => setMemorisationReveal(true)}>
                <Text style={styles.flowButtonText}>Reveal Text</Text>
              </Pressable>
            </View>
            <Pressable style={styles.lessonCompletionButton} onPress={() => finishFullRecall(true)}>
              <Text style={styles.lessonCompletionButtonText}>I remembered it</Text>
            </Pressable>
            <Pressable style={[styles.lessonCompletionButton, styles.learnActionButtonSecondary]} onPress={() => finishFullRecall(false)}>
              <Text style={styles.lessonCompletionButtonText}>I need to revise</Text>
            </Pressable>
          </>
        )}

        {activeMemorisationStepIndex === 5 && (
          <View style={styles.pathwayCompletionPanel}>
            {memorisationRemembered ? (
              <>
                {renderCompletionIcon()}
                <Text style={styles.lessonCompletionTitle}>Alhamdulillah!</Text>
                <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>
                  You have completed memorisation practice for this lesson.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.lessonCompletionTitle}>Review this lesson again.</Text>
                <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>
                  Repeat the memorisation steps until you can recall it confidently.
                </Text>
              </>
            )}
            <Text style={styles.flowHint}>
              Progress saved: {MUTUN_MEMORISATION_STAGES.filter(stage => tracker[stage] || (stage === 'memorised' && memorisationRemembered)).length}/{MUTUN_MEMORISATION_STAGES.length} steps
            </Text>
            <Pressable style={styles.lessonCompletionButton} onPress={() => setLearnMode(returnMode)}>
              <Text style={styles.lessonCompletionButtonText}>Return to {sourceTitle}</Text>
            </Pressable>
            <Pressable
              style={[styles.lessonCompletionButton, styles.learnActionButtonCompleted]}
              onPress={() => {
                setActiveMemorisationStepIndex(0);
                setMemorisationRepeatChecks({});
                setMemorisationReveal(false);
                setMemorisationRemembered(false);
              }}
            >
              <Text style={styles.lessonCompletionButtonText}>{memorisationRemembered ? 'Revise Again' : 'Try Again'}</Text>
            </Pressable>
          </View>
        )}

        {activeMemorisationStepIndex > 0 && activeMemorisationStepIndex < 5 && (
          <Pressable
            style={styles.secondaryTextButton}
            onPress={() => {
              setMemorisationReveal(false);
              setActiveMemorisationStepIndex(index => Math.max(0, index - 1));
            }}
          >
            <Text style={styles.secondaryTextButtonText}>Back</Text>
          </Pressable>
        )}
        <Pressable style={styles.secondaryTextButton} onPress={() => setLearnMode(returnMode)}>
          <Text style={styles.secondaryTextButtonText}>Exit Memorisation</Text>
        </Pressable>
      </Animated.View>
    );
  };

  const renderReviewFlow = () => {
    const quizCards = activeReviewCards;
    const quizCard = quizCards[activeReviewIndex];

    if (reviewSessionSummary.answered > 0 && activeReviewIndex >= quizCards.length) {
      const totalQuestions = quizCards.length || reviewSessionSummary.answered || 3;
      const score = totalQuestions
        ? Math.round((reviewSessionSummary.correct / totalQuestions) * 100)
        : 0;
      const passedDailyQuiz = reviewSessionSummary.correct === totalQuestions;
      const answerResults = reviewSessionSummary.answers || [];
      return (
        <Animated.View style={[styles.learnCard, styles.flowCard, { opacity: cardFadeAnim, transform: [{ translateY: cardSlideAnim }] }]}>
          <Text style={styles.lessonLevel}>Daily Quiz</Text>
          <Text style={styles.lessonTitle}>{passedDailyQuiz ? 'Excellent!' : 'Daily Quiz Results'}</Text>
          {passedDailyQuiz ? (
            <>
              <Text style={styles.completionIcon}>🎉</Text>
              <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>You achieved 100%.</Text>
              <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>Daily Quiz Completed.</Text>
              <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>
                Keep reviewing your lessons and continue seeking beneficial knowledge.
              </Text>
            </>
          ) : (
            <>
              <View style={styles.quizResultList}>
                {answerResults.map((answer, index) => (
                  <View key={`${answer.questionId}-${index}`} style={styles.quizResultRow}>
                    <Text style={styles.quizResultText}>Question {index + 1}</Text>
                    <Text style={answer.correct ? styles.quizResultCorrect : styles.quizResultWrong}>
                      {answer.correct ? '✅ Correct' : '❌ Incorrect'}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.quizScoreText}>Score: {reviewSessionSummary.correct}/{totalQuestions}</Text>
              <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>You did not achieve 100%.</Text>
              <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>Please review and try again.</Text>
            </>
          )}
          <View style={styles.reviewSummaryGrid}>
            <View style={styles.reviewSummaryItem}>
              <Text style={styles.reviewSummaryNumber}>{reviewSessionSummary.answered}</Text>
              <Text style={styles.reviewSummaryLabel}>Questions answered</Text>
            </View>
            <View style={styles.reviewSummaryItem}>
              <Text style={styles.reviewSummaryNumber}>{reviewSessionSummary.correct}</Text>
              <Text style={styles.reviewSummaryLabel}>Correct</Text>
            </View>
            <View style={styles.reviewSummaryItem}>
              <Text style={styles.reviewSummaryNumber}>{score}%</Text>
              <Text style={styles.reviewSummaryLabel}>Score</Text>
            </View>
          </View>
          {passedDailyQuiz ? (
            <Pressable style={styles.learnActionButton} onPress={() => setLearnMode('overview')}>
              <Text style={styles.learnActionText}>Back to Learn</Text>
            </Pressable>
          ) : (
            <>
              <Pressable style={styles.learnActionButton} onPress={retryDailyQuiz}>
                <Text style={styles.learnActionText}>Retry Quiz</Text>
              </Pressable>
              <Pressable style={styles.secondaryTextButton} onPress={() => setLearnMode('overview')}>
                <Text style={styles.secondaryTextButtonText}>Back to Learn</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      );
    }

    if (!quizCard) {
      return (
        <View style={styles.learnCard}>
          <Text style={styles.lessonTitle}>Daily Quiz</Text>
          <Text style={[styles.lessonSummary, scaledTextStyle(16)]}>No quiz questions are available yet. Complete a lesson first, then come back for a short daily quiz.</Text>
          <Pressable style={styles.secondaryTextButton} onPress={() => setLearnMode('overview')}>
            <Text style={styles.secondaryTextButtonText}>Back to Learn</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <Animated.View style={[styles.learnCard, styles.flowCard, { opacity: cardFadeAnim, transform: [{ translateY: cardSlideAnim }] }]}>
        <View style={styles.learnCardHeader}>
          <Text style={styles.lessonLevel}>Daily Quiz</Text>
          <Text style={styles.completedBadge}>{activeReviewIndex + 1}/{quizCards.length}</Text>
        </View>
        {renderAnimatedProgressBar()}
        <Text style={styles.quizTitle}>{quizCard.level === 'arbain' ? 'Arbain Nawawi' : `${quizCard.level} pathway`}</Text>
        <Text style={[styles.quizQuestion, scaledTextStyle(17)]}>{quizCard.question}</Text>
        {(quizCard.questionType === 'multiple_choice' || quizCard.questionType === 'true_false') && (
          <>
            {getShuffledOptions(
              quizCard.questionType === 'true_false' ? ['True', 'False'] : quizCard.options,
              `${getTodayKey()}:${quizCard.id}`
            ).map(option => (
              <Pressable
                key={option}
                style={styles.quizOption}
                onPress={() => handleDailyQuizAnswer(option)}
              >
                <Text style={[styles.quizOptionText, scaledTextStyle(15)]}>{option}</Text>
              </Pressable>
            ))}
          </>
        )}
        {quizCard.questionType === 'fill_blank' && (
          <>
            <TextInput
              style={[styles.dailyQuizInput, scaledTextStyle(16)]}
              value={dailyQuizInput}
              onChangeText={setDailyQuizInput}
              placeholder="Type your answer"
              placeholderTextColor="#8a9995"
              autoCapitalize="none"
              returnKeyType="done"
              onFocus={() => {
                setTimeout(() => {
                  scrollRef.current?.scrollToEnd({ animated: true });
                }, 120);
              }}
              onSubmitEditing={() => handleDailyQuizAnswer(dailyQuizInput)}
            />
            <Pressable
              style={[styles.learnActionButton, !dailyQuizInput.trim() && styles.learnActionButtonDisabled]}
              disabled={!dailyQuizInput.trim()}
              onPress={() => handleDailyQuizAnswer(dailyQuizInput)}
            >
              <Text style={styles.learnActionText}>Submit Answer</Text>
            </Pressable>
          </>
        )}
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
    const currentPathwayLessonCardCount = currentPathwayLessons.length * 2;
    const currentPathwayContentCardCount = getPathwayCardCount(currentPathway.id);
    const safePathwayIndex = clampLearningIndex(safeProgress.currentPathwayCardIndex, getPathwayFlowCardCount(currentPathway.id) || 1);
    const isResumePathwayComplete = safePathwayIndex >= currentPathwayContentCardCount;
    const isResumeQuiz = !isResumePathwayComplete && safePathwayIndex >= currentPathwayLessonCardCount;
    const resumeLessonIndex = Math.floor(safePathwayIndex / 2);
    const currentLessonLabel = isResumePathwayComplete
      ? `${currentPathway.title}: Completion card`
      : isResumeQuiz
      ? `Continue ${currentPathway.title}: Quiz ${safePathwayIndex - currentPathwayLessonCardCount + 1} of ${currentPathwayQuizzes.length}`
      : `${currentPathway.title}: Lesson ${Math.min(resumeLessonIndex + 1, currentPathwayLessons.length)} of ${currentPathwayLessons.length}`;
    const dailyQuizCards = selectDailyQuizQuestions(safeProgress);
    const dailyQuizStreakCount = getDailyQuizStreakCount(safeProgress);

    if (learnMode === 'nawawi') {
      return renderNawawiPage();
    }

    if (learnMode === 'nawawiHadith') {
      return renderNawawiFlow();
    }

    if (learnMode === 'bayquniyyah') {
      return renderBayquniyyahPage();
    }

    if (learnMode === 'bayquniyyahLesson') {
      return renderBayquniyyahFlow();
    }

    if (learnMode === 'mutunMemorisation') {
      return renderMutunMemorisationFlow();
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
            <Text style={styles.continueLearningLabel}>Daily Quiz</Text>
            <Text style={styles.completedBadge}>{dailyQuizCards.length} questions</Text>
          </View>
          <Text style={styles.continueLearningText}>
            {dailyQuizCards.length
              ? 'Answer 3 quick recall questions from lessons you have completed.'
              : 'Complete a lesson first to unlock your Daily Quiz.'}
          </Text>
          <Text style={styles.continueLearningMeta}>
            Daily quiz streak: {dailyQuizStreakCount} day{dailyQuizStreakCount === 1 ? '' : 's'} • Questions are based on lessons you completed.
          </Text>
          <Pressable
            style={[styles.reviewStartButton, !dailyQuizCards.length && styles.learnActionButtonDisabled]}
            disabled={!dailyQuizCards.length}
            onPress={openReviewFlow}
          >
            <Text style={styles.learnActionText}>{dailyQuizCards.length ? 'Start Daily Quiz' : 'Quiz Locked'}</Text>
          </Pressable>
        </View>
      </View>

      {learnMode === 'overview' && (
        <>
          <Text style={styles.learnSectionTitle}>Pathway Previews</Text>
          {renderPathwayPreviews()}

          <Text style={styles.learnSectionTitle}>Arbain Nawawi Learning</Text>
          {renderNawawiOverview()}

          <Text style={styles.learnSectionTitle}>Bayquniyyah Learning</Text>
          {renderBayquniyyahOverview()}

          <Text style={styles.learnSectionTitle}>Future Paid Version</Text>
          <Text style={styles.premiumIntro}>Free modules include Arbain Nawawi and Bayquniyyah. A future paid version is planned to include deeper guided study tools.</Text>
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

  const currentGuidedTourStep = GUIDED_TOUR_STEPS[guidedTourIndex] || GUIDED_TOUR_STEPS[0];
  const guidedTourPlacementStyle =
    currentGuidedTourStep?.placement === 'top'
      ? styles.guidedTourBackdropTop
      : currentGuidedTourStep?.placement === 'upperMiddle'
        ? styles.guidedTourBackdropUpperMiddle
        : currentGuidedTourStep?.placement === 'center'
          ? styles.guidedTourBackdropCenter
          : styles.guidedTourBackdropBottom;

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
                Takhrij lets you search and study hadith across 16 collections with over 50,000 narrations.
              </Text>
              <Text style={styles.welcomeText}>
                Arabic and English hadith search is available from the database. AI commentary is limited to 5 uses per day for free users.
              </Text>
              <Text style={styles.welcomeSectionTitle}>Features include</Text>
              <View style={styles.welcomeBulletList}>
                <Text style={styles.welcomeBullet}>• Search over 50,000 hadith across 16 collections</Text>
                <Text style={styles.welcomeBullet}>• Search in Arabic, English, or by reference</Text>
                <Text style={styles.welcomeBullet}>• Learn through Arbain Nawawi and Bayquniyyah pathways</Text>
                <Text style={styles.welcomeBullet}>• Build consistent learning habits with Daily Quiz</Text>
                <Text style={styles.welcomeBullet}>• Track progress with memorisation focused learning tools</Text>
              </View>
              <Text style={styles.welcomeDisclaimer}>
                Takhrij is for learning and reflection. It does not replace qualified scholars, formal study, or scholarly takhrij.
              </Text>
              <Pressable style={styles.welcomeButton} onPress={dismissWelcome}>
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
          visible={onboardingVisible}
          transparent
          animationType="slide"
          onRequestClose={finishOnboarding}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContent, styles.onboardingModalContent]}>
              <Text style={styles.onboardingProgress}>{onboardingIndex + 1} / {ONBOARDING_SCREENS.length}</Text>
              <View style={styles.onboardingProgressTrack}>
                <View
                  style={[
                    styles.onboardingProgressFill,
                    { width: `${((onboardingIndex + 1) / ONBOARDING_SCREENS.length) * 100}%` },
                  ]}
                />
              </View>
              <ScrollView contentContainerStyle={styles.onboardingScrollContent}>
                <Text style={styles.onboardingTitle}>{ONBOARDING_SCREENS[onboardingIndex].title}</Text>
                <Text style={[styles.onboardingBody, scaledTextStyle(16)]}>{ONBOARDING_SCREENS[onboardingIndex].body}</Text>
                {!!ONBOARDING_SCREENS[onboardingIndex].points?.length && (
                  <View style={styles.onboardingPointList}>
                    {ONBOARDING_SCREENS[onboardingIndex].points.map(point => (
                      <Text key={point} style={[styles.onboardingPoint, scaledTextStyle(15)]}>• {point}</Text>
                    ))}
                  </View>
                )}
              </ScrollView>
              <View style={styles.onboardingControls}>
                <Pressable
                  style={[
                    styles.onboardingSecondaryButton,
                    onboardingIndex === 0 && styles.flowButtonDisabled,
                  ]}
                  disabled={onboardingIndex === 0}
                  onPress={() => setOnboardingIndex(index => Math.max(0, index - 1))}
                >
                  <Text style={styles.onboardingSecondaryButtonText}>Back</Text>
                </Pressable>
                <Pressable style={styles.onboardingSkipButton} onPress={finishOnboarding}>
                  <Text style={styles.onboardingSkipButtonText}>Skip</Text>
                </Pressable>
                <Pressable
                  style={styles.onboardingPrimaryButton}
                  onPress={() => {
                    if (onboardingIndex >= ONBOARDING_SCREENS.length - 1) {
                      finishOnboarding();
                    } else {
                      setOnboardingIndex(index => Math.min(ONBOARDING_SCREENS.length - 1, index + 1));
                    }
                  }}
                >
                  <Text style={styles.onboardingPrimaryButtonText}>
                    {onboardingIndex >= ONBOARDING_SCREENS.length - 1 ? 'Start Using Takhrij' : 'Next'}
                  </Text>
                </Pressable>
              </View>
              {onboardingIndex >= ONBOARDING_SCREENS.length - 1 && (
                <Pressable
                  style={styles.guidedTourStartButton}
                  onPress={async () => {
                    await finishOnboarding();
                    openGuidedTour();
                  }}
                >
                  <Text style={styles.guidedTourStartButtonText}>Start Guided Tour</Text>
                </Pressable>
              )}
            </View>
          </View>
        </Modal>

        <Modal
          visible={guidedTourVisible}
          transparent
          animationType="fade"
          onRequestClose={finishGuidedTour}
        >
          <View style={[styles.guidedTourBackdrop, guidedTourPlacementStyle]}>
            <View style={styles.guidedTourCard}>
              <Text style={styles.guidedTourProgress}>{guidedTourIndex + 1} / {GUIDED_TOUR_STEPS.length}</Text>
              <View style={styles.guidedTourTargetRow}>
                <Text style={styles.guidedTourArrow}>{currentGuidedTourStep?.pointer || '↓ Look here'}</Text>
                <View style={styles.guidedTourTargetPill}>
                  <Text style={styles.guidedTourTargetText}>{currentGuidedTourStep?.label}</Text>
                </View>
              </View>
              <Text style={styles.guidedTourTitle}>{currentGuidedTourStep?.title}</Text>
              <Text style={[styles.guidedTourBody, scaledTextStyle(16)]}>{currentGuidedTourStep?.body}</Text>
              <View style={styles.onboardingProgressTrack}>
                <View
                  style={[
                    styles.onboardingProgressFill,
                    { width: `${((guidedTourIndex + 1) / GUIDED_TOUR_STEPS.length) * 100}%` },
                  ]}
                />
              </View>
              <View style={styles.guidedTourControls}>
                <Pressable style={styles.onboardingSkipButton} onPress={finishGuidedTour}>
                  <Text style={styles.onboardingSkipButtonText}>Skip Tour</Text>
                </Pressable>
                <Pressable
                  style={styles.onboardingPrimaryButton}
                  onPress={() => {
                    if (guidedTourIndex >= GUIDED_TOUR_STEPS.length - 1) {
                      finishGuidedTour();
                    } else {
                      const nextIndex = guidedTourIndex + 1;
                      setGuidedTourIndex(nextIndex);
                      applyGuidedTourStep(nextIndex);
                    }
                  }}
                >
                  <Text style={styles.onboardingPrimaryButtonText}>
                    {guidedTourIndex >= GUIDED_TOUR_STEPS.length - 1 ? 'Finish Tour' : 'Next'}
                  </Text>
                </Pressable>
              </View>
            </View>
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
                <Text style={[styles.modalText, scaledTextStyle(16)]}>{commentaryData.commentary}</Text>
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
    <Text style={[styles.modalText, scaledTextStyle(16)]}>Chain not available.</Text>
  )}
</View>
              </ScrollView>
              <Text style={styles.modalDisclaimer}>
                AI-generated commentary. This response is for educational support only. Please verify important religious matters with qualified teachers and reliable scholarly sources.
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
    const textToShare = buildHadithShareText({
      reference: commentaryData.reference,
      arabic: commentaryData.arabic,
      english: commentaryData.english,
      authenticityStatus: commentaryData.authenticityStatus,
      commentary: commentaryData.commentary,
      chain: commentaryData.chain,
    });
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
                Narrator summaries are educational and may not be complete scholarly biographies. They may contain errors. Please verify with classical rijāl sources such as Tahdhīb al-Tahdhīb, Taqrīb al-Tahdhīb, Siyar Aʿlām al-Nubalāʾ, and Mīzān al-Iʿtidāl.
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
                <Text style={[styles.modalText, scaledTextStyle(16)]}>
                  Your donation helps cover server costs, GPT credits, and further development of the app.
                </Text>
                <Text style={[styles.modalText, scaledTextStyle(16)]}>
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
              <Text style={[styles.modalText, scaledTextStyle(16)]}>
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
      <Text style={[styles.modalText, scaledTextStyle(16)]}>
        Takhrij helps Muslims search across 16 hadith collections with over 50,000 narrations in Arabic and English. It also supports AI assisted commentary, narrator biography lookup, Arbain Nawawi and Bayquniyyah learning pathways, Daily Quiz, progress tracking, and memorisation focused learning tools.{"\n\n"}
        Takhrij is an educational and research aid. AI commentary and narrator biography content are AI generated and may contain mistakes or incomplete information. Please verify important religious matters with qualified teachers and reliable scholarly sources.{"\n\n"}
        The app is not a fatwa service. AI commentary is limited to 5 uses per day for free users.
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
      <Text style={styles.modalHeader}>Preferences & Information</Text>
      <ScrollView contentContainerStyle={styles.modalScrollContent}>
        <Text style={styles.settingsGroupTitle}>Preferences</Text>
        <Text style={styles.settingsSectionTitle}>Text size</Text>
        <View style={styles.preferenceOptionRow}>
          {TEXT_SIZE_OPTIONS.map(option => (
            <Pressable
              key={option.key}
              style={[
                styles.preferenceOption,
                userPreferences.textSize === option.key && styles.preferenceOptionActive,
              ]}
              onPress={() => updateUserPreference('textSize', option.key)}
            >
              <Text
                style={[
                  styles.preferenceOptionText,
                  userPreferences.textSize === option.key && styles.preferenceOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.settingsSectionTitle}>Arabic text size</Text>
        <View style={styles.preferenceOptionRow}>
          {TEXT_SIZE_OPTIONS.map(option => (
            <Pressable
              key={option.key}
              style={[
                styles.preferenceOption,
                userPreferences.arabicTextSize === option.key && styles.preferenceOptionActive,
              ]}
              onPress={() => updateUserPreference('arabicTextSize', option.key)}
            >
              <Text
                style={[
                  styles.preferenceOptionText,
                  userPreferences.arabicTextSize === option.key && styles.preferenceOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.settingsSectionTitle}>Daily Review Reminder</Text>
        <Pressable
          style={styles.settingsToggleRow}
          onPress={toggleDailyReviewReminder}
        >
          <View style={styles.settingsToggleCopy}>
            <Text style={styles.settingsToggleTitle}>Daily Review Reminder</Text>
            <Text style={styles.settingsToggleDescription}>8:00 PM local reminder for revision and Daily Quiz.</Text>
          </View>
          <View style={[
            styles.settingsToggle,
            userPreferences.dailyReviewReminderEnabled && styles.settingsToggleActive,
          ]}>
            <View style={[
              styles.settingsToggleKnob,
              userPreferences.dailyReviewReminderEnabled && styles.settingsToggleKnobActive,
            ]} />
          </View>
        </Pressable>

        <Text style={styles.settingsGroupTitle}>Information</Text>
        <Pressable
          style={styles.settingsInfoButton}
          onPress={openOnboarding}
        >
          <Text style={styles.settingsInfoButtonText}>How to Use Takhrij</Text>
        </Pressable>
        <Pressable
          style={styles.settingsInfoButton}
          onPress={openGuidedTour}
        >
          <Text style={styles.settingsInfoButtonText}>Start Guided Tour</Text>
        </Pressable>
        <Pressable
          style={styles.settingsInfoButton}
          onPress={resetTutorialState}
        >
          <Text style={styles.settingsInfoButtonText}>Reset Tutorial State</Text>
        </Pressable>

        <Text style={styles.settingsSectionTitle}>About Takhrij</Text>
        <Text style={[styles.modalText, scaledTextStyle(16)]}>
          Takhrij helps Muslims search across 16 hadith collections with over 50,000 narrations in Arabic and English. It includes AI assisted commentary, narrator biography lookup, Arbain Nawawi and Bayquniyyah learning pathways, Daily Quiz, progress tracking, and memorisation focused learning tools.
        </Text>

        <Text style={styles.settingsSectionTitle}>Educational Disclaimer</Text>
        <Text style={[styles.modalText, scaledTextStyle(16)]}>
          Takhrij is an educational and research aid, not a fatwa service. AI commentary and narrator biography content are AI generated and may contain mistakes or incomplete information. Please verify important religious matters with qualified teachers and reliable scholarly sources. AI commentary is limited to 5 uses per day for free users.
        </Text>

        <Text style={styles.settingsSectionTitle}>Support Takhrij</Text>
        <Text style={[styles.modalText, scaledTextStyle(16)]}>
          Support helps cover hosting, search infrastructure, and careful development of learning features.
        </Text>
        <Pressable
          style={styles.settingsSupportButton}
          onPress={() => {
            setSettingsVisible(false);
            setDonationVisible(true);
          }}
        >
          <Text style={styles.settingsSupportButtonText}>Support Takhrij</Text>
        </Pressable>

        <Text style={styles.settingsSectionTitle}>Contact / Feedback</Text>
        <Text style={[styles.modalText, scaledTextStyle(16)]}>Feedback and support contact: takhrijapp@gmail.com</Text>

        <Text style={styles.settingsSectionTitle}>App Version</Text>
        <Text style={[styles.modalText, scaledTextStyle(16)]}>Version {APP_VERSION}</Text>

        <Text style={styles.settingsSectionTitle}>Restore Purchases</Text>
        <Text style={[styles.modalText, scaledTextStyle(16)]}>Restore purchases will be available when premium features are introduced.</Text>

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

      <Text style={[styles.modalText, scaledTextStyle(16)]}>
        Definition: {item.definition}
      </Text>

      <Text style={[styles.modalText, scaledTextStyle(16)]}>
        Reference: {item.reference}
      </Text>

      <Text style={[styles.modalText, scaledTextStyle(16)]}>
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
                  <Text style={[styles.modalText, scaledTextStyle(16)]}>• Nuzhat al-Nazar by Ibn Hajar al-ʿAsqalānī</Text>
                  <Text style={[styles.modalText, scaledTextStyle(16)]}>• Muqaddimah Ibn al-Salāh by Ibn al-Salāh</Text>
                  <Text style={[styles.modalText, scaledTextStyle(16)]}>• Tadrīb al-Rāwī by al-Suyūtī</Text>
                </View>

<Text style={[styles.modalText, { marginTop: 10, fontWeight: 'bold' }]}>English Sources:</Text>
<View style={{ marginLeft: 10 }}>
  <Text style={[styles.modalText, scaledTextStyle(16)]}>• An Introduction to the Science of Hadith by Suhaib Hasan</Text>
  <Text style={[styles.modalText, scaledTextStyle(16)]}>• Studies in Hadith Methodology and Literature by Muhammad Mustafa Azami</Text>
  <Text style={[styles.modalText, scaledTextStyle(16)]}>• The Science of Hadith Terminology and Classification by Dr. Muhammad Saeed Mitwally ar-Rahawan</Text>
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
          <View style={styles.headerBrand}>
            <Image source={require('./assets/icon.png')} style={styles.headerLogo} />
            <Text style={styles.headerText}>Takhrij</Text>
          </View>
          <Pressable
            style={styles.headerSettingsButton}
            onPress={() => setSettingsVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open preferences and information"
          >
            <View style={styles.overflowIcon}>
              <View style={styles.overflowDot} />
              <View style={styles.overflowDot} />
              <View style={styles.overflowDot} />
            </View>
          </Pressable>
        </LinearGradient>

        <KeyboardAvoidingView
          style={styles.screenContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
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
              <View style={styles.searchRow}>
                <View style={styles.searchInputWrapper}>
                  <TextInput
                    placeholder="Search hadith or reference..."
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
                      {showSearchHelp ? '- Search Tips and Disclaimer' : '+ Search Tips and Disclaimer'}
                    </Text>
                  </Pressable>
                  {showSearchHelp && (
                    <>
                      <Text style={styles.helpSectionTitle}>Search Tips</Text>
                      <Text style={styles.helpStaticText}>- Search by Arabic</Text>
                      <Text style={styles.helpStaticText}>- Search by English</Text>
                      <Text style={styles.helpStaticText}>- Search by reference</Text>

                      <View style={styles.newCollectionsInset}>
                        <Text style={styles.helpSectionTitle}>New Collections Added</Text>
                        <Text style={styles.helpStaticText}>
                          Takhrij now searches across 16 hadith collections with over 50,000 hadith.
                        </Text>
                        <Text style={styles.newCollectionsList}>
                          - Shama'il Muhammadiyah{'\n'}
                          - Mishkat al-Masabih{'\n'}
                          - Riyad as-Salihin{'\n'}
                          - Bulugh al-Maram{'\n'}
                          - Al-Adab al-Mufrad{'\n'}
                          - Forty Hadith Qudsi{'\n'}
                          - Forty Hadith of Imam Nawawi
                        </Text>
                        <Text style={styles.helpSectionTitle}>Example searches</Text>
                        <Text style={styles.newCollectionsExamples}>
                          - Bulugh al-Maram 1{'\n'}
                          - Shama'il Muhammadiyah 1{'\n'}
                          - Riyad as-Salihin 1
                        </Text>
                      </View>

                      <Text style={styles.helpSectionTitle}>Disclaimer</Text>
                      <Text style={[styles.helpStaticText, styles.helpDisclaimer]}>
                        Takhrij is a beginner-friendly learning tool. It does not replace qualified scholars, formal study, or scholarly takhrij.
                      </Text>
                    </>
                  )}
                </View>
              )}
            </View>

<TouchableOpacity style={styles.supportButton} onPress={() => setGlossaryModalVisible(true)}>
  <Text style={styles.supportButtonText}>Ulum Hadith Glossary</Text>
  <Text style={styles.supportButtonSubtext}>Sciences of Hadith terms</Text>
</TouchableOpacity>

{!hasResults && (
  
  <>
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
                <View style={styles.resultCardHeader}>
                  <View style={styles.resultMetadataGroup}>
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
                  </View>
                  {!isSearchSuggestionReference(h.reference) && (
                    <View style={styles.resultHeaderActions}>
                      <Pressable
                        style={styles.resultIconButton}
                        onPress={() => copyHadith(h)}
                        accessibilityRole="button"
                        accessibilityLabel="Copy hadith"
                      >
                        <Ionicons name="copy-outline" size={20} color="#176b5f" />
                      </Pressable>
                      <Pressable
                        style={styles.resultIconButton}
                        onPress={() => shareHadith(h)}
                        accessibilityRole="button"
                        accessibilityLabel="Share hadith"
                      >
                        <Ionicons name="share-social-outline" size={20} color="#176b5f" />
                      </Pressable>
                    </View>
                  )}
                </View>
                {h.arabic    && <Text style={[styles.arabicMatn, scaledArabicTextStyle(21)]}>{h.arabic}</Text>}
                {h.english && h.english.split('\n').map((para, index) => (
  <Text key={`english-${index}`} style={[styles.englishMatn, scaledTextStyle(16)]}>{para.trim()}</Text>
))}
                {h.warning   && <Text style={[styles.warning, scaledTextStyle(14)]}>{h.warning}</Text>}
                {!isSearchSuggestionReference(h.reference) && (
                  <Pressable
                    style={styles.commentaryButton}
                    onPress={() => fetchCommentary(h.arabic, h.english, h.reference, h.collection)}
                  >
                    <Text style={styles.commentaryText}>View AI Commentary</Text>
                  </Pressable>
                )}
              </View>
            ))}

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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    shadowColor: '#092225',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  headerText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
  },
  headerSettingsButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  overflowDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#f7f1df',
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
  newCollectionsList: {
    color: '#41504d',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  newCollectionsExamples: {
    color: '#176b5f',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    fontWeight: '800',
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
  helpSectionTitle: {
    color: '#132f35',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 2,
  },
  helpStaticText: {
    fontSize: 13,
    color: '#41504d',
    marginTop: 8,
    lineHeight: 19,
  },
  newCollectionsInset: {
    marginTop: 8,
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
    maxWidth: '100%',
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 8,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#d7e5ce',
  },
  referenceBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1b433f',
    flexShrink: 1,
  },
  resultAuthenticityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f8f5e9',
    borderWidth: 1,
    borderColor: '#e7d9a8',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 9,
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
  learnCardCompleted: {
    backgroundColor: '#f4fbf6',
    borderColor: '#8ac7a4',
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
  completedStatusBadge: {
    color: '#0f5f47',
    backgroundColor: '#dff3e6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '900',
  },
  memorisedBadge: {
    alignSelf: 'flex-start',
    color: '#176b5f',
    backgroundColor: '#e9f5ee',
    borderWidth: 1,
    borderColor: '#b9d9c6',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
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
  arabicSpeakerButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#cfdcd3',
    backgroundColor: '#f4f7f2',
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 999,
    marginBottom: 12,
  },
  arabicSpeakerText: {
    color: '#176b5f',
    fontSize: 13,
    fontWeight: '800',
  },
  memoriseModeButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#cfdcd3',
    backgroundColor: '#edf4e8',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  memoriseModeButtonText: {
    color: '#176b5f',
    fontSize: 14,
    fontWeight: '800',
  },
  recallHiddenPanel: {
    backgroundColor: '#f4f7f2',
    borderWidth: 1,
    borderColor: '#d7e5ce',
    borderRadius: 8,
    padding: 18,
    marginBottom: 14,
  },
  recallHiddenText: {
    color: '#415355',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
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
  learnActionButtonCompleted: {
    backgroundColor: '#0f5f47',
  },
  learnActionButtonDisabled: {
    backgroundColor: '#aebdb8',
  },
  learnActionText: {
    color: '#fff',
    fontWeight: '800',
  },
  lessonCompletionPanel: {
    borderWidth: 1,
    borderColor: '#d8e2dc',
    backgroundColor: '#f7faf7',
    borderRadius: 8,
    padding: 18,
    marginTop: 4,
  },
  pathwayCompletionPanel: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d8e2dc',
    backgroundColor: '#f7faf7',
    borderRadius: 8,
    padding: 20,
    marginTop: 4,
  },
  completionActionRow: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  completionProgressText: {
    color: '#176b5f',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
    marginBottom: 10,
    textAlign: 'center',
  },
  completionIconVector: {
    marginBottom: 12,
    textAlign: 'center',
  },
  completionIcon: {
    color: '#176b5f',
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
  },
  lessonCompletionEyebrow: {
    color: '#176b5f',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  lessonCompletionTitle: {
    color: '#132f35',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 10,
  },
  lessonCompletionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#176b5f',
    borderRadius: 8,
    paddingVertical: 15,
    paddingHorizontal: 18,
    marginTop: 8,
    marginBottom: 8,
    minHeight: 54,
  },
  lessonCompletionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  reviewHintText: {
    color: '#667774',
    lineHeight: 21,
    marginTop: 4,
  },
  reviewActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  reviewActionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  reviewRememberButton: {
    backgroundColor: '#176b5f',
  },
  reviewAgainButton: {
    borderWidth: 1,
    borderColor: '#ccd8d4',
    backgroundColor: '#f8faf8',
  },
  reviewRememberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  reviewAgainText: {
    color: '#176b5f',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  reviewSummaryGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  reviewSummaryItem: {
    flex: 1,
    backgroundColor: '#f5f8f6',
    borderWidth: 1,
    borderColor: '#dde7e3',
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  reviewSummaryNumber: {
    color: '#0f3d3e',
    fontSize: 20,
    fontWeight: '900',
  },
  reviewSummaryLabel: {
    color: '#667774',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 3,
  },
  quizResultList: {
    borderWidth: 1,
    borderColor: '#dde7e3',
    backgroundColor: '#f7faf7',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  quizResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  quizResultText: {
    color: '#132f35',
    fontSize: 14,
    fontWeight: '800',
  },
  quizResultCorrect: {
    color: '#176b5f',
    fontSize: 14,
    fontWeight: '900',
  },
  quizResultWrong: {
    color: '#8a3a32',
    fontSize: 14,
    fontWeight: '900',
  },
  quizScoreText: {
    color: '#132f35',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
  },
  lockedPathwayNotice: {
    color: '#607174',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 8,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  lockedLessonNoticeRow: {
    alignItems: 'flex-start',
    marginTop: 8,
    width: '100%',
  },
  lockedLessonIcon: {
    marginBottom: 6,
  },
  lockedLessonNoticeText: {
    color: '#607174',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
    width: '100%',
    flexShrink: 1,
    flexWrap: 'wrap',
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
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  flowButtonDisabled: {
    backgroundColor: '#aebdb8',
  },
  flowButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  flowButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  flowButtonChevron: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 18,
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
  dailyQuizInput: {
    borderWidth: 1,
    borderColor: '#d7dfd5',
    backgroundColor: '#f7faf7',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 13,
    color: '#132f35',
    marginBottom: 10,
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
  resultCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  resultMetadataGroup: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 6,
  },
  resultHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  resultIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f7f2',
    borderWidth: 1,
    borderColor: '#cfdcd3',
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
  onboardingModalContent: {
    maxHeight: height * 0.7,
    padding: 18,
  },
  onboardingProgress: {
    color: '#176b5f',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  onboardingProgressTrack: {
    height: 6,
    backgroundColor: '#e7eee5',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 16,
  },
  onboardingProgressFill: {
    height: '100%',
    backgroundColor: '#d8b15a',
    borderRadius: 999,
  },
  onboardingScrollContent: {
    paddingBottom: 8,
  },
  onboardingTitle: {
    color: '#132f35',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
  },
  onboardingBody: {
    color: '#2f3d40',
    fontSize: 16,
    lineHeight: 25,
    textAlign: 'center',
    marginBottom: 10,
  },
  onboardingPointList: {
    backgroundColor: '#f7faf7',
    borderWidth: 1,
    borderColor: '#d7dfd5',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  onboardingPoint: {
    color: '#41504d',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '700',
    marginBottom: 3,
  },
  onboardingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  onboardingPrimaryButton: {
    flex: 1.25,
    minHeight: 44,
    backgroundColor: '#176b5f',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  onboardingPrimaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  onboardingSecondaryButton: {
    minHeight: 44,
    minWidth: 64,
    borderWidth: 1,
    borderColor: '#cfdcd3',
    backgroundColor: '#f4f7f2',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  onboardingSecondaryButtonText: {
    color: '#176b5f',
    fontSize: 14,
    fontWeight: '900',
  },
  onboardingSkipButton: {
    minHeight: 44,
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  onboardingSkipButtonText: {
    color: '#607174',
    fontSize: 14,
    fontWeight: '900',
  },
  guidedTourStartButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#d8b15a',
    backgroundColor: '#fff9e9',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 10,
  },
  guidedTourStartButtonText: {
    color: '#7a5a12',
    fontSize: 14,
    fontWeight: '900',
  },
  guidedTourBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 23, 26, 0.68)',
    padding: 18,
    paddingBottom: 24,
  },
  guidedTourBackdropTop: {
    justifyContent: 'flex-start',
    paddingTop: 96,
  },
  guidedTourBackdropUpperMiddle: {
    justifyContent: 'flex-start',
    paddingTop: 170,
  },
  guidedTourBackdropCenter: {
    justifyContent: 'center',
  },
  guidedTourBackdropBottom: {
    justifyContent: 'flex-end',
  },
  guidedTourCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e9df',
    padding: 18,
    shadowColor: '#102a2e',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 6,
  },
  guidedTourProgress: {
    color: '#176b5f',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  guidedTourTargetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  guidedTourArrow: {
    color: '#d8b15a',
    fontSize: 28,
    fontWeight: '900',
  },
  guidedTourTargetPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d7e5ce',
    backgroundColor: '#edf4e8',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  guidedTourTargetText: {
    color: '#176b5f',
    fontSize: 13,
    fontWeight: '900',
  },
  guidedTourTitle: {
    color: '#132f35',
    fontSize: 21,
    fontWeight: '900',
    marginBottom: 8,
  },
  guidedTourBody: {
    color: '#2f3d40',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  guidedTourControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
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
  settingsGroupTitle: {
    color: '#132f35',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 4,
    marginBottom: 8,
  },
  settingsSectionTitle: {
    color: '#176b5f',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  preferenceOptionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  preferenceOption: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7dfd5',
    backgroundColor: '#f7faf7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  preferenceOptionActive: {
    borderColor: '#176b5f',
    backgroundColor: '#edf4e8',
  },
  preferenceOptionText: {
    color: '#41504d',
    fontSize: 13,
    fontWeight: '800',
  },
  preferenceOptionTextActive: {
    color: '#176b5f',
  },
  settingsToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: '#d7dfd5',
    backgroundColor: '#f7faf7',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  settingsToggleCopy: {
    flex: 1,
  },
  settingsToggleTitle: {
    color: '#132f35',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 3,
  },
  settingsToggleDescription: {
    color: '#607174',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  settingsToggle: {
    width: 50,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#c8d3ce',
    padding: 3,
    justifyContent: 'center',
  },
  settingsToggleActive: {
    backgroundColor: '#176b5f',
  },
  settingsToggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#fff',
    shadowColor: '#102a2e',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  settingsToggleKnobActive: {
    alignSelf: 'flex-end',
  },
  settingsSupportButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#176b5f',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
  },
  settingsSupportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  settingsInfoButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#cfdcd3',
    backgroundColor: '#f4f7f2',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  settingsInfoButtonText: {
    color: '#176b5f',
    fontSize: 14,
    fontWeight: '900',
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
supportButtonSubtext: {
  color: '#cddbd4',
  fontSize: 12,
  fontWeight: '700',
  textAlign: 'center',
  marginTop: 3,
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
