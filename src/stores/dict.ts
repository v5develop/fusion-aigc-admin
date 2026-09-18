import type { DictData } from '@/types/dict';

import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useDictStore = defineStore('dict', () => {
  const dictData = ref<Map<string, DictData[]>>(new Map());

  function getDictByType(typeCode: string): DictData[] {
    return dictData.value.get(typeCode) ?? [];
  }

  function getDictLabel(typeCode: string, value: string): string {
    const items = getDictByType(typeCode);
    const item = items.find((d) => d.value === value);
    return item?.label ?? value;
  }

  function getDictValue(typeCode: string, label: string): string {
    const items = getDictByType(typeCode);
    const item = items.find((d) => d.label === label);
    return item?.value ?? label;
  }

  function getDictOptions(typeCode: string) {
    return getDictByType(typeCode).map((d) => ({
      label: d.label,
      value: d.value,
    }));
  }

  function setDictData(typeCode: string, data: DictData[]) {
    dictData.value.set(typeCode, data);
  }

  async function refreshDictData(): Promise<void> {
    // Placeholder - implement when API is ready
  }

  return {
    dictData,
    getDictByType,
    getDictLabel,
    getDictValue,
    getDictOptions,
    setDictData,
    refreshDictData,
  };
});
