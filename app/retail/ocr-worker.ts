import {createWorker} from 'tesseract.js';

type Request = {files: File[]};
const scope = self as unknown as {postMessage: (message: unknown) => void; onmessage: ((event: MessageEvent<Request>) => void) | null};

scope.onmessage = async (event: MessageEvent<Request>) => {
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  try {
    worker = await createWorker('eng', 1, {logger: message => scope.postMessage({type:'progress',value:`${message.status} ${Math.round((message.progress || 0) * 100)}%`})});
    let text = '';
    for (const file of event.data.files) {
      const result = await worker.recognize(file);
      text += result.data.text + '\n';
    }
    scope.postMessage({type:'complete',text});
  } catch (error) {
    scope.postMessage({type:'error',message:error instanceof Error ? error.message : 'OCR failed'});
  } finally { await worker?.terminate(); }
};
