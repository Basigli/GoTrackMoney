<template>
  <div class="max-w-md mx-auto bg-white p-6 rounded shadow">
    <h2 class="text-xl font-bold mb-4">Register</h2>
    <form @submit.prevent="submit">
      <label class="block mb-2">
        <span class="text-gray-700">Username</span>
        <input v-model="username" type="text" required class="mt-1 block w-full border rounded px-3 py-2" />
      </label>
      <label class="block mb-2">
        <span class="text-gray-700">Password</span>
        <input v-model="password" type="password" required class="mt-1 block w-full border rounded px-3 py-2" />
      </label>
      <button type="submit" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded">Register</button>
      <p v-if="error" class="text-sm text-red-600 mt-2">{{ error }}</p>
      <p v-if="success" class="text-sm text-green-600 mt-2">{{ success }}</p>
    </form>
  </div>
</template>

<script>
export default {
  name: 'Register',
  data() {
    return {
      username: '',
      password: '',
      error: null,
      success: null
    }
  },
  methods: {
    async submit() {
      this.error = null
      this.success = null
      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: this.username, password: this.password })
        })
        if (!res.ok) throw new Error(await res.text())
        this.success = 'Registered successfully'
        this.username = ''
        this.password = ''
      } catch (e) {
        this.error = e.message
      }
    }
  }
}
</script>

<style scoped>
</style>
