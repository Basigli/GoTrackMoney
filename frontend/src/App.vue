<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="max-w-xl p-6 bg-white rounded shadow">
      <h1 class="text-2xl font-bold mb-4">GoTrackMoney</h1>
      <div class="space-x-2 mb-4">
        <button @click="view='login'" class="px-3 py-1 bg-green-600 text-white rounded">Login</button>
        <button @click="view='register'" class="px-3 py-1 bg-blue-600 text-white rounded">Register</button>
      </div>
      <component :is="viewComponent" @login="onLogin"></component>
    </div>
  </div>
</template>

<script>
import Login from './components/Login.vue'
import Register from './components/Register.vue'

export default {
  name: 'App',
  components: { Login, Register },
  data() {
    return { view: 'login' }
  },
  computed: {
    viewComponent() {
      return this.view === 'login' ? 'Login' : 'Register'
    }
  },
  methods: {
    onLogin() {
      this.view = 'dashboard'
      // simple placeholder
      alert('Logged in — dashboard placeholder')
    }
  }
}
</script>

<style scoped>
</style>
