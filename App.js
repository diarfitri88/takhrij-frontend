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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import Markdown from 'react-native-markdown-display';

const { width, height } = Dimensions.get('window');

const APP_DOWNLOAD_LINK = `
Download the Takhrij App:
Android: https://play.google.com/store/apps/details?id=com.yourapp.takhrij
iOS: Coming soon
`;

const API_BASE_URL = 'https://takhrij-backend.onrender.com';

const postJson = async (path, payload) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

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
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCommentary, setLoadingCommentary] = useState(false);
  const [commentaryModalVisible, setCommentaryModalVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [glossaryModalVisible, setGlossaryModalVisible] = useState(false);
  const [commentaryData, setCommentaryData] = useState({
    commentary: '',
    chain: '',
    evaluation: ''
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
  setSelectedNarrator(narratorName);
  setNarratorBioVisible(true);
  setNarratorBioText('Loading biography...');
  try {
    const data = await postJson('/narrator-bio', { name: narratorName });
    const raw = data.bio || 'Biography not available.';
    setNarratorBioText(raw);
  } catch {
    setNarratorBioText('Error fetching biography.');
  }
};

  const verifyHadith = async () => {
    setCommentaryModalVisible(false);
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setResult('');
    try {
      const data = await postJson('/search-hadith', { query: q });
      setResult(data.result || '');
    } catch {
      setResult('Error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCommentary = async (arabic, english, reference, collection) => {
    setLoadingCommentary(true);
    const eng = english.trim() || arabic.trim();
    const collToSend = collection || reference.split(' ').slice(0, 2).join(' ');
    try {
      const json = await postJson('/gpt-commentary', { arabic, english: eng, reference, collection: collToSend });
      setCommentaryData({
        commentary: json.commentary || 'No commentary.',
        chain: json.chain || 'No chain.',
        evaluation: json.evaluation || 'No evaluation.',
        arabic: arabic || '',
        english: english || '',
        reference: reference || ''
      });
    } catch {
      setCommentaryData({ commentary: 'Error fetching commentary.', chain: '', evaluation: '' });
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
      let english = (s.match(/English Matn:\s*([\s\S]*?)(?=\r?\nReference:|$)/i) || [])[1]?.trim() || '';
      english = english.replace(/[\r\n]+/g, ' ').replace(/[*_]/g, '').trim();
      const reference = (s.match(/Reference:\s*(.*?)$/im) || [])[1]?.trim() || '';
      const warning = (s.match(/Warning:\s*(.*?)$/im) || [])[1]?.trim() || '';
      const nameParts = reference.split(' ').slice(0, 2).join(' ');
      const collection = COLLECTION_KEY_MAP[nameParts] || '';
      return { arabic, english, reference, warning, collection };
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
        setNarratorBioVisible(false);
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
            <Text style={styles.welcomeTitle}>Welcome to Takhrij</Text>
            <Text style={styles.welcomeText}>
  {`Reviving the Sunnah, one hadith at a time.\n\n• Search across the 9 major hadith collections.\n• Learn the meaning, context, and chain of narrators.\n• Explore essential terms from the science of hadith (ʿUlūm al-Hadīth).\n• Get concise, AI-supported commentary to aid your study.\n\nStill no result? Don’t worry — our AI will generate a best-effort explanation for you!`}
</Text>
            <Text style={styles.welcomeDisclaimer}>
              ⚠️ AI-generated commentary. Always verify with reliable scholars for fatwa.
            </Text>
            <Pressable style={styles.welcomeButton} onPress={() => setShowWelcome(false)}>
              <Text style={styles.welcomeButtonText}>Start Your Search</Text>
            </Pressable>
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
                <Text style={styles.sectionHeader}>Commentary</Text>
                <Text style={styles.modalText}>{commentaryData.commentary}</Text>
                <Text style={styles.sectionHeader}>Chain of Narrators (click to view biography)</Text>
<View style={styles.chainContainer}>
  {commentaryData.chain
    .split('→')
    .map((rawName, idx, arr) => {
      const narrator = rawName.trim();
      return (
        <React.Fragment key={idx}>
          <TouchableOpacity onPress={() => fetchNarratorBio(narrator)}>
            <Text style={styles.linkText}>{narrator}</Text>
          </TouchableOpacity>
          {idx < arr.length - 1 && (
            <Text style={styles.arrow}>→</Text>
          )}
        </React.Fragment>
      );
    })}
</View>
                <Text style={styles.sectionHeader}>Evaluation of Hadith</Text>
                <Text style={styles.modalText}>{commentaryData.evaluation}</Text>
              </ScrollView>
              <Text style={styles.modalDisclaimer}>
                ⚠️ This is an AI-generated explanation and may contain errors or inaccuracies. Always verify the information with qualified scholars.
              </Text>
              <View style={styles.shareCopyRow}>
                <TouchableOpacity
                  style={styles.shareCopyButton}
                  onPress={async () => {
                    const textToCopy = `Hadith Reference: ${commentaryData.reference}\n\nArabic Matn:\n${commentaryData.arabic}\n\nEnglish Matn:\n${commentaryData.english}\n\nCommentary:\n${commentaryData.commentary}\n\nChain of Narrators:\n${commentaryData.chain}\n\nEvaluation:\n${commentaryData.evaluation}`;
                    await Clipboard.setStringAsync(textToCopy);
                    alert('Copied to clipboard!');
                  }}
                >
                  <Text style={styles.shareCopyText}>Copy</Text>
                </TouchableOpacity>

                <TouchableOpacity
  style={styles.shareCopyButton}
  onPress={async () => {
    const textToShare = `Hadith Reference: ${commentaryData.reference}\n\nArabic Matn:\n${commentaryData.arabic}\n\nEnglish Matn:\n${commentaryData.english}\n\nCommentary:\n${commentaryData.commentary}\n\nChain of Narrators:\n${commentaryData.chain}\n\nEvaluation:\n${commentaryData.evaluation}\n\n${APP_DOWNLOAD_LINK}`;
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
        Takhrij is a tool designed to help you search, explore, and verify Hadiths from the 9 major collections of Islam. This app is a tool to assist your study, not a substitute for scholarly guidance. Always verify results with qualified scholars.{"\n\n"} 
        AI responses may and will contain errors or inaccuracies.{"\n\n"}
        Developed to make the science of Hadith accessible to everyone.
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
            <View style={styles.searchCard}>
              <Text style={styles.searchTitle}>Find a Hadith</Text>
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
                  📌 How to use: Enter a keyword (e.g. intention) or phrase (e.g. glad tidings to the strangers) in the search bar. The app will search the 9 major hadith collections. If no match is found, AI will generate a best-effort explanation.
                </Text>
                <Text style={[styles.helpStaticText, styles.helpDisclaimer]}>
                  ⚠️ Disclaimer: This app is a tool to ease your research or study, not a replacement for seeking knowledge directly from scholars. AI responses MAY and WILL contain errors. Always verify with qualified scholars.
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
                {h.arabic    && <Text style={styles.arabicMatn}>{h.arabic}</Text>}
                {h.english && h.english.split('\n').map((para, index) => (
  <Text key={`english-${index}`} style={styles.englishMatn}>{para.trim()}</Text>
))}
                {h.warning   && <Text style={styles.warning}>{h.warning}</Text>}
                {h.reference !== 'AI Generated' && (
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
    alignItems: 'flex-start',
    padding: 24,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  welcomeTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 17,
    color: '#ecf0f1',
    textAlign: 'left',
    lineHeight: 27,
    marginBottom: height * 0.1,
  },
  welcomeDisclaimer: {
    fontSize: 14,
    color: '#eee',
    textAlign: 'left',
    fontStyle: 'italic',
    marginTop: 12,
  },
  welcomeButton: {
    marginTop: 24,
    backgroundColor: '#d8b15a',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
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
    marginBottom: 14,
    color: '#132f35',
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
    marginVertical: 8,
  },
  linkText: {
    color: '#176b5f',
    textDecorationLine: 'underline',
    fontWeight: '800',
  },
  background: {
    flex: 1,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 20, 22, 0.72)',
  },
});
