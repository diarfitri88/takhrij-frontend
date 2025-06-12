import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

const { width, height } = Dimensions.get('window');

const COLLECTION_KEY_MAP = {
  'Sahih Bukhari':    'bukhari',
  'Sahih Muslim':     'muslim',
  'Jami` at-Tirmidhi':'tirmidhi',
  "Sunan an-Nasa'i":  'nasai',
  'Sunan Ibn Majah':  'ibnmajah',
  'Muwatta Malik':    'malik',
  'Musnad Ahmad':     'ahmed',
  'Sunan Abu Dawood':'abudawud',
  'Sunan ad-Darimi':  'darimi',
};
const glossary = [
  {
    "term": "Hadith",
    "definition": "A report of the sayings, actions, approvals, or characteristics of the Prophet Muhammad (peace be upon him).",
    "reference": "An Introduction to the Science of Hadith by Ibn al-Salah",
    "example": "The Prophet said: 'Actions are judged by intentions.' (Bukhari & Muslim)"
  },
  {
    "term": "Isnad",
    "definition": "The chain of narrators who transmitted the Hadith.",
    "reference": "Nukhbat al-Fikr by Ibn Hajar al-Asqalani",
    "example": "Malik → Nafi' → Ibn Umar → Prophet Muhammad (peace be upon him)"
  },
  {
    "term": "Matn",
    "definition": "The actual text or content of the Hadith.",
    "reference": "Nukhbat al-Fikr by Ibn Hajar al-Asqalani",
    "example": "'Actions are judged by intentions.'"
  },
  {
    "term": "Marfu'",
    "definition": "A narration attributed directly to the Prophet Muhammad (peace be upon him), regardless of the continuity of the chain.",
    "reference": "Nukhbat al-Fikr by Ibn Hajar al-Asqalani",
    "example": "The Prophet said: 'Whoever lies upon me deliberately, let him prepare his seat in the Hellfire.'"
  },
  {
    "term": "Mawquf",
    "definition": "A narration attributed to a Companion of the Prophet, without attributing it to the Prophet himself.",
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

  const verifyHadith = async () => {
    setCommentaryModalVisible(false);
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setResult('');
    try {
      const res = await fetch('https://takhrij-backend.onrender.com/search-hadith', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setResult(data.result || '');
    } catch {
      setResult('Error connecting to server.');
    }
    setLoading(false);
  };

  const fetchCommentary = async (arabic, english, reference, collection) => {
    setLoadingCommentary(true);
    const eng = english.trim() || arabic.trim();
    const collToSend = collection || reference.split(' ').slice(0,2).join(' ');
    try {
      const res = await fetch('https://takhrij-backend.onrender.com/gpt-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arabic, english: eng, reference, collection: collToSend }),
      });
      const json = await res.json();
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
    }
    setLoadingCommentary(false);
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
      const nameParts = reference.split(' ').slice(0,2).join(' ');
      const collection = COLLECTION_KEY_MAP[nameParts] || '';
      return { arabic, english, reference, warning, collection };
    }).filter(o => o.arabic || o.english);
    return { extraText: extraText.trim(), hadithSections };
  };

  const { extraText, hadithSections } = parseResult(result);
  const hasResults = !loading && hadithSections.length > 0;
  const noResults  = !loading && extraText.startsWith('❌');

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
                <Text style={styles.sectionHeader}>Chain of Narrators</Text>
                <Text style={styles.modalText}>{commentaryData.chain}</Text>
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
                    const textToShare = `Hadith Reference: ${commentaryData.reference}\n\nArabic Matn:\n${commentaryData.arabic}\n\nEnglish Matn:\n${commentaryData.english}\n\nCommentary:\n${commentaryData.commentary}\n\nChain of Narrators:\n${commentaryData.chain}\n\nEvaluation:\n${commentaryData.evaluation}`;
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

        <Modal
  visible={thankYouVisible}
  transparent
  animationType="slide"
  onRequestClose={() => setThankYouVisible(false)}
>
  <View style={styles.modalBackdrop}>
    <View style={styles.modalContent}>
      <Text style={styles.modalHeader}>Thank You!</Text>
      <Text style={styles.modalText}>Your support means a lot. JazakAllahu khairan for helping us continue our work.</Text>
      <TouchableOpacity
        style={styles.modalCloseButton}
        onPress={() => setThankYouVisible(false)}
      >
        <Text style={styles.modalCloseText}>Close</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>



        <TouchableOpacity
  style={styles.donateButton}
  onPress={() => {
    Linking.openURL('https://www.paypal.me/takhrij');
    setDonationVisible(false);
    setThankYouVisible(true);
  }}
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
        {glossary.map((item, index) => (
          <View key={index} style={{ marginBottom: 15 }}>
            <Text style={[styles.modalText, { fontWeight: '700' }]}>{item.term}</Text>
            <Text style={styles.modalText}>Definition: {item.definition}</Text>
            <Text style={styles.modalText}>Reference: {item.reference}</Text>
            <Text style={styles.modalText}>Example: {item.example}</Text>
          </View>
        ))}
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

        <LinearGradient colors={['#16a085', '#117864']} style={styles.header}>
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
                {h.reference && <Text style={styles.referenceBadge}>{h.reference}</Text>}
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
    padding: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 18,
    color: '#ecf0f1',
    textAlign: 'left',
    lineHeight: 26,
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
    backgroundColor: '#2c3e50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
  },
  welcomeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#c7e4e0',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  screenContainer: { flex: 1 },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  searchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: 8,
    backgroundColor: '#ddd',
    borderRadius: 8,
    padding: 4,
  },
  searchButton: {
    marginLeft: 12,
    backgroundColor: '#16a085',
    borderRadius: 8,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  searchButtonDisabled: {
    backgroundColor: '#67a3cf',
  },
  searchHelp: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  helpStaticCard: {
    backgroundColor: '#f0f4f8',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  helpStaticText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
  helpDisclaimer: {
    fontWeight: 'bold',
    color: '#c0392b',
  },
  noResultCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  noResultText: {
    color: '#555',
    textAlign: 'center',
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  referenceBadge: {
    backgroundColor: '#2ecc71',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  arabicMatn: {
    fontSize: 20,
    lineHeight: 32,
    color: '#111',
    textAlign: 'right',
    marginBottom: 8,
    fontWeight: '700',
  },
  englishMatn: {
    fontSize: 16,
    lineHeight: 24,
    color: '#222',
    textAlign: 'left',
    marginBottom: 8,
  },
  warning: {
    fontSize: 14,
    lineHeight: 20,
    color: '#c0392b',
    marginBottom: 8,
    fontWeight: '600',
  },
  commentaryButton: {
    backgroundColor: '#2980b9',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  commentaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  contactText: {
  fontSize: 14,
  color: '#000',
  textAlign: 'center',
  marginTop: 8,
  textDecorationLine: 'underline',
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: height * 0.75,
    padding: 20,
    alignSelf: 'center',
    width: '90%',
  },
  modalHeader: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    color: '#333',
  },
  modalScroll: {
    marginBottom: 12,
  },
  modalScrollContent: {
    paddingBottom: 8,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    color: '#2c3e50',
  },
  modalText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  modalDisclaimer: {
    fontSize: 12,
    color: '#c0392b',
    marginTop: 16,
    textAlign: 'left',
    fontStyle: 'italic',
  },
  modalCloseButton: {
    marginTop: 20,
    backgroundColor: '#e74c3c',
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
    justifyContent: 'space-around',
    marginTop: 12,
  },
  donateButton: {
  backgroundColor: '#27ae60',
  paddingVertical: 12,
  borderRadius: 8,
  marginTop: 12,
},
supportButton: {
  backgroundColor: '#2f80ed',
  paddingVertical: 14,
  borderRadius: 12,
  alignItems: 'center',
  marginBottom: 16,
},
supportButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '600',
},
donateButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '600',
  textAlign: 'center',
},
donateLink: {
  color: '#f1c40f',
  fontSize: 14,
  marginTop: 4,
  textDecorationLine: 'underline',
},
  shareCopyButton: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  shareCopyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  background: {
    flex: 1,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
});
