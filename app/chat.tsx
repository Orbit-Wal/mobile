import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { askCodeAssistant } from "@/services/codeAssistant";
import type { ChatMessage } from "@/types/chat";

const starters = ["Explain a TypeScript function", "Help debug an error", "Write a React component"];

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const sendMessage = async (value = input) => {
    const content = value.trim();
    if (!content || sending) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`, role: "user", content, createdAt: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const answer = await askCodeAssistant(nextMessages);
      setMessages((current) => [
        ...current,
        { id: `${Date.now()}-assistant`, role: "assistant", content: answer.message, code: answer.code, language: answer.language, createdAt: new Date().toISOString() },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      Alert.alert("Code assistant unavailable", message);
    } finally {
      setSending(false);
    }
  };

  const copyCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert("Copied", "Code copied to your clipboard.");
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Text style={styles.title}>Code Assistant</Text>
        <Text style={styles.subtitle}>Generate, understand, and improve code</Text>
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.messages} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>What can I help you build?</Text>
            <Text style={styles.emptyCopy}>Ask about code, errors, refactors, or documentation.</Text>
            <View style={styles.starters}>
              {starters.map((starter) => <Pressable key={starter} style={styles.starter} onPress={() => sendMessage(starter)}><Text style={styles.starterText}>{starter}</Text></Pressable>)}
            </View>
          </View>
        )}
        {messages.map((message) => (
          <View key={message.id} style={[styles.message, message.role === "user" ? styles.userMessage : styles.assistantMessage]}>
            <Text style={styles.role}>{message.role === "user" ? "You" : "Code Assistant"}</Text>
            <Text style={styles.messageText}>{message.content}</Text>
            {message.code && <View style={styles.codeBlock}><View style={styles.codeHeader}><Text style={styles.language}>{message.language ?? "code"}</Text><Pressable onPress={() => copyCode(message.code!)}><Text style={styles.copy}>Copy</Text></Pressable></View><Text style={styles.code}>{message.code}</Text></View>}
          </View>
        ))}
        {sending && <View style={[styles.message, styles.assistantMessage, styles.loading]}><ActivityIndicator color="#a78bfa" /><Text style={styles.thinking}>Thinking…</Text></View>}
      </ScrollView>
      <View style={styles.composer}><TextInput value={input} onChangeText={setInput} placeholder="Ask about code…" placeholderTextColor="#64748b" multiline style={styles.input} editable={!sending} /><Pressable style={[styles.sendButton, (!input.trim() || sending) && styles.sendDisabled]} onPress={() => sendMessage()} disabled={!input.trim() || sending}><Text style={styles.sendText}>Send</Text></Pressable></View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" }, header: { padding: 24, paddingTop: 64, borderBottomWidth: 1, borderBottomColor: "#1e293b" }, title: { color: "#f8fafc", fontSize: 24, fontWeight: "700" }, subtitle: { color: "#94a3b8", marginTop: 4 }, messages: { padding: 16, flexGrow: 1 }, emptyState: { flex: 1, justifyContent: "center", paddingBottom: 96 }, emptyTitle: { color: "#f8fafc", fontSize: 22, fontWeight: "700", textAlign: "center" }, emptyCopy: { color: "#94a3b8", textAlign: "center", marginTop: 8 }, starters: { gap: 10, marginTop: 28 }, starter: { borderColor: "#334155", borderWidth: 1, borderRadius: 12, padding: 14 }, starterText: { color: "#c4b5fd" }, message: { borderRadius: 14, padding: 14, marginBottom: 12, maxWidth: "92%" }, userMessage: { backgroundColor: "#4c1d95", alignSelf: "flex-end" }, assistantMessage: { backgroundColor: "#1e293b", alignSelf: "flex-start" }, role: { color: "#a78bfa", fontSize: 12, fontWeight: "700", marginBottom: 6 }, messageText: { color: "#f8fafc", fontSize: 15, lineHeight: 22 }, codeBlock: { backgroundColor: "#020617", borderRadius: 8, marginTop: 12, overflow: "hidden" }, codeHeader: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 8, borderBottomColor: "#1e293b", borderBottomWidth: 1 }, language: { color: "#94a3b8", fontSize: 12 }, copy: { color: "#c4b5fd", fontSize: 12, fontWeight: "700" }, code: { color: "#e2e8f0", fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }), fontSize: 12, lineHeight: 18, padding: 10 }, loading: { flexDirection: "row", alignItems: "center", gap: 10 }, thinking: { color: "#94a3b8" }, composer: { borderTopColor: "#1e293b", borderTopWidth: 1, padding: 12, flexDirection: "row", gap: 10, alignItems: "flex-end" }, input: { flex: 1, color: "#f8fafc", backgroundColor: "#1e293b", borderRadius: 12, minHeight: 46, maxHeight: 120, paddingHorizontal: 14, paddingVertical: 12 }, sendButton: { backgroundColor: "#7c3aed", paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12 }, sendDisabled: { opacity: 0.45 }, sendText: { color: "#fff", fontWeight: "700" },
});
