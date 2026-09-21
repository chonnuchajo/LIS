import type { ParameterItem } from '@/lib/api';
import type { AdditionalSampleRequest, Petition, QCTestResult } from '@/types/petition.types';

type SamplePetition = Pick<Petition, 'additionalSampleRequests'>;

export function additionalSampleWeights(item: AdditionalSampleRequest['items'][number]): number[] {
  return item.weights?.length ? item.weights : [item.quantity];
}

export function pendingAdditionalSample(petition: SamplePetition | null | undefined, side: AdditionalSampleRequest['side']) {
  return petition?.additionalSampleRequests?.find((request) => request.side === side && request.status !== 'received');
}

export function sampleRoundFor(petition: SamplePetition | null | undefined, side: AdditionalSampleRequest['side'], itemSeq: number) {
  let latest: AdditionalSampleRequest | undefined;
  for (const request of petition?.additionalSampleRequests ?? []) {
    if (request.side !== side || request.status !== 'received' || !request.items.some((item) => item.itemSeq === itemSeq)) continue;
    latest = request;
  }
  return latest;
}

export function sampleRoundIdFor(petition: SamplePetition | null | undefined, side: AdditionalSampleRequest['side'], itemSeq: number) {
  return sampleRoundFor(petition, side, itemSeq)?._id;
}

export function currentSampleResults(petition: SamplePetition, results: QCTestResult[], parameters: Pick<ParameterItem, '_id' | 'scope'>[]) {
  return results.filter((result) => {
    const parameter = parameters.find((candidate) => candidate._id === result.parameterId);
    if (!parameter) return true;
    return (result.sampleRoundId || undefined) === sampleRoundIdFor(petition, parameter.scope ?? 'qc', result.itemSeq);
  });
}

export function createResultAutosaveQueue() {
  const pending = new Map<string, { save: () => Promise<void>; timer: ReturnType<typeof setTimeout>; serialKey: string }>();
  const running = new Map<string, Promise<void>>();
  const failed = new Set<string>();

  const run = (key: string, save: () => Promise<void>, serialKey = key) => {
    const previous = running.get(serialKey);
    const task = (async () => {
      if (previous) await previous.catch(() => {});
      try {
        await save();
        failed.delete(key);
      } catch (error) {
        failed.add(key);
        throw error;
      }
    })();
    running.set(serialKey, task);
    const settled = () => { if (running.get(serialKey) === task) running.delete(serialKey); };
    void task.then(settled, settled);
    return task;
  };

  return {
    run,
    schedule(key: string, save: () => Promise<void>, serialKey = key) {
      clearTimeout(pending.get(key)?.timer);
      const timer = setTimeout(() => {
        pending.delete(key);
        void run(key, save, serialKey).catch(() => {});
      }, 800);
      pending.set(key, { save, timer, serialKey });
    },
    async flush() {
      while (pending.size || running.size) {
        for (const [key, { save, timer, serialKey }] of pending) {
          clearTimeout(timer);
          pending.delete(key);
          void run(key, save, serialKey).catch(() => {});
        }
        await Promise.allSettled([...running.values()]);
      }
      if (failed.size) throw new Error('บันทึกผลไม่สำเร็จ กรุณาแก้ไขช่องที่บันทึกไม่สำเร็จแล้วลองใหม่');
    },
  };
}
