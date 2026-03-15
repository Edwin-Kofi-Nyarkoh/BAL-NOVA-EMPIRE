import React, { useState } from "react"
import { SafeAreaView, View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from "react-native"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { StatusBar } from "expo-status-bar"
import { fetchAnalyticsOverview, fetchFinanceSummary, fetchInventory, forgotPassword, login } from "./src/api"

const queryClient = new QueryClient()

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <Text style={{ fontWeight: "700", marginBottom: 6 }}>{title}</Text>
      {children}
    </View>
  )
}

function MobileHome({ token, role, onLogout }: { token: string; role: string; onLogout: () => void }) {
  const inventoryQuery = useQuery({ queryKey: ["inventory"], queryFn: () => fetchInventory(token) })
  const financeQuery = useQuery({ queryKey: ["finance"], queryFn: () => fetchFinanceSummary(token) })
  const analyticsQuery = useQuery({
    queryKey: ["analytics"],
    queryFn: () => fetchAnalyticsOverview(token),
    enabled: role === "admin"
  })

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 12 }}>BAL Mobile</Text>

      <Card title="Inventory">
        {inventoryQuery.isLoading ? <ActivityIndicator /> : <Text>Items: {inventoryQuery.data?.items?.length ?? 0}</Text>}
      </Card>

      <Card title="Finance">
        {financeQuery.isLoading ? (
          <ActivityIndicator />
        ) : (
          <Text>
            Payments: {financeQuery.data?.summary.paymentTotal ?? 0} | Ledger: {financeQuery.data?.summary.ledgerTotal ?? 0}
          </Text>
        )}
      </Card>

      {role === "admin" ? (
        <Card title="Analytics">
          {analyticsQuery.isLoading ? <ActivityIndicator /> : <Text>Users: {analyticsQuery.data?.overview.users ?? 0}</Text>}
        </Card>
      ) : null}

      <Pressable onPress={onLogout} style={{ backgroundColor: "#111", padding: 12, borderRadius: 8 }}>
        <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>Logout</Text>
      </Pressable>
    </ScrollView>
  )
}

function LoginScreen({ onLogin }: { onLogin: (token: string, role: string) => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function handleLogin() {
    setLoading(true)
    setMessage("")
    try {
      const result = await login(email, password)
      onLogin(result.token, result.user.role)
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot() {
    setLoading(true)
    setMessage("")
    try {
      const result = await forgotPassword(email)
      setMessage(result.devResetToken ? `Reset token (dev): ${result.devResetToken}` : "If account exists, reset started.")
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, justifyContent: "center", padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "800", marginBottom: 16 }}>BAL Login</Text>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, marginBottom: 10 }}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, marginBottom: 10 }}
      />

      <Pressable onPress={handleLogin} disabled={loading} style={{ backgroundColor: "#111", padding: 12, borderRadius: 8, marginBottom: 8 }}>
        <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>{loading ? "Loading..." : "Login"}</Text>
      </Pressable>

      <Pressable onPress={handleForgot} disabled={loading} style={{ borderWidth: 1, borderColor: "#111", padding: 12, borderRadius: 8 }}>
        <Text style={{ textAlign: "center", fontWeight: "700" }}>Forgot Password</Text>
      </Pressable>

      {message ? <Text style={{ marginTop: 12 }}>{message}</Text> : null}
    </SafeAreaView>
  )
}

export default function App() {
  const [token, setToken] = useState("")
  const [role, setRole] = useState("user")

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      {token ? (
        <MobileHome
          token={token}
          role={role}
          onLogout={() => {
            setToken("")
            setRole("user")
            queryClient.clear()
          }}
        />
      ) : (
        <LoginScreen
          onLogin={(nextToken, nextRole) => {
            setToken(nextToken)
            setRole(nextRole)
          }}
        />
      )}
    </QueryClientProvider>
  )
}
