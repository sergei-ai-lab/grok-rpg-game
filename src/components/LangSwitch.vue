<template>
  <div class="lang-switch" role="group" :aria-label="tr('Language', 'Язык')">
    <button type="button" :class="{ 'is-on': locale === 'ru' }" @click="store.setLang('ru')">RU</button>
    <button type="button" :class="{ 'is-on': locale === 'en-US' }" @click="store.setLang('en-US')">EN</button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { tr } from '@/locales/text'
import { useGlobalState } from '@/store'

const store = useGlobalState()
const { locale } = useI18n()
</script>

<style scoped>
.lang-switch {
  display: flex;
  border: 1px solid rgb(255 255 255 / 16%);
  background: rgb(0 0 0 / 35%);
}
.lang-switch button {
  min-width: 44px;
  min-height: 36px;
  padding: 0 10px;
  color: rgb(255 255 255 / 55%);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.lang-switch button.is-on {
  background: #e2a04a;
  color: #1a1208;
}
</style>
