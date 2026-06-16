<template>
  <div class="max-w-md mx-auto bg-white p-6 rounded shadow">
    <h2 class="text-xl font-bold mb-4">Login</h2>
    <form @submit.prevent="submit">
      <label class="block mb-2">
        <span class="text-gray-700">Username</span>
        <input v-model="username" type="text" required class="mt-1 block w-full border rounded px-3 py-2" />
      </label>
      <label class="block mb-2">
        <span class="text-gray-700">Password</span>
        <input v-model="password" type="password" required class="mt-1 block w-full border rounded px-3 py-2" />
      </label>
      <button type="submit" class="mt-4 bg-green-600 text-white px-4 py-2 rounded">Login</button>
      <p v-if="error" class="text-sm text-red-600 mt-2">{{ error }}</p>
    </form>
  </div>
</template>

<script>
export default {
  name: 'Login',
  data() {
    return {
      username: '',
      password: '',
      error: null
    }
  },
  methods: {
    async submit() {
      this.error = null
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: this.username, password: this.password })
        })
        if (!res.ok) throw new Error(await res.text())
        // store token
        const data = await res.json()
        localStorage.setItem('token', data.token)
        this.$emit('login')
      } catch (e) {
        this.error = e.message
      }
    }
  }
}
</script>

<style scoped>
</style>
