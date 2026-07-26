'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type VoiceState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'acting' | 'speaking' | 'error';

type TimelineEvent = {
  id: number;
  label: string;
  tone: 'quiet' | 'active' | 'success' | 'error';
};

type VoiceTurnResponse = {
  ok?: boolean;
  error?: string;
  transcript?: string;
  reply?: string;
  languageCode?: string;
  toolEvents?: string[];
  audioBase64?: string;
  audioType?: string;
};

const stateCopy: Record<VoiceState, { eyebrow: string; title: string }> = {
  acting: { eyebrow: 'ON YOUR PHONE', title: 'Doing it now' },
  connecting: { eyebrow: 'OPENING THE MIC', title: 'One moment' },
  error: { eyebrow: 'VOICE PAUSED', title: 'Tap to try again' },
  idle: { eyebrow: 'READY WHEN YOU ARE', title: 'What needs doing?' },
  listening: { eyebrow: 'SARVAM IS LISTENING', title: 'Go ahead' },
  speaking: { eyebrow: 'ERRANDOS', title: 'Done' },
  thinking: { eyebrow: 'UNDERSTANDING', title: 'Making a safe plan' },
};

function preferredAudioType(): string | undefined {
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

export default function VoiceHome() {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [assistantText, setAssistantText] = useState('Tap the centre, speak, then tap again.');
  const [timeline, setTimeline] = useState<TimelineEvent[]>([
    { id: 1, label: 'Pixel 9 available', tone: 'success' },
    { id: 2, label: 'Sarvam Indian-language voice ready', tone: 'success' },
  ]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const eventIdRef = useRef(3);

  const addTimelineEvent = useCallback((label: string, tone: TimelineEvent['tone']) => {
    setTimeline((current) => [
      { id: eventIdRef.current++, label, tone },
      ...current,
    ].slice(0, 4));
  }, []);

  const releaseMicrophone = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      window.clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const submitRecording = useCallback(async (audio: Blob) => {
    setVoiceState('thinking');
    setAssistantText('Sarvam heard you. Planning the task…');
    addTimelineEvent('Understanding with Sarvam', 'active');

    try {
      const body = new FormData();
      const extension = audio.type.includes('mp4') ? 'm4a' : 'webm';
      body.set('audio', audio, `command.${extension}`);
      body.set('clientId', 'pixel-web');

      const response = await fetch('/api/voice/turn', {
        body,
        method: 'POST',
      });
      const result = await response.json() as VoiceTurnResponse;
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? 'The voice request failed.');
      }

      if (result.transcript) {
        const heard = result.transcript.length > 64
          ? `${result.transcript.slice(0, 61)}…`
          : result.transcript;
        addTimelineEvent(`Heard: ${heard}`, 'success');
      }

      for (const event of result.toolEvents ?? []) {
        addTimelineEvent(
          event === 'open_blinkit' ? 'Opened Blinkit on your Pixel' : `Phone action: ${event}`,
          'success',
        );
      }

      const reply = result.reply ?? 'Done.';
      setAssistantText(reply);

      if (result.audioBase64) {
        setVoiceState('speaking');
        const player = audioRef.current;
        if (player) {
          player.src = `data:${result.audioType ?? 'audio/mpeg'};base64,${result.audioBase64}`;
          player.onended = () => setVoiceState('idle');
          await player.play();
          return;
        }
      }

      setVoiceState('idle');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The voice request failed.';
      setVoiceState('error');
      setAssistantText(message);
      addTimelineEvent(message, 'error');
    }
  }, [addTimelineEvent]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') {
      setVoiceState('thinking');
      setAssistantText('Sending your voice securely…');
      recorder.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    setVoiceState('connecting');
    setAssistantText('Opening your microphone…');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = preferredAudioType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const audio = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        });
        releaseMicrophone();
        void submitRecording(audio);
      };

      recorder.start();
      setVoiceState('listening');
      setAssistantText('Speak naturally in Hindi, Hinglish, English, or your local language.');
      addTimelineEvent('Listening on your phone', 'active');
      recordingTimerRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 28_000);
    } catch (error) {
      releaseMicrophone();
      const message = error instanceof Error ? error.message : 'Could not open the microphone.';
      setVoiceState('error');
      setAssistantText(message);
      addTimelineEvent(message, 'error');
    }
  }, [addTimelineEvent, releaseMicrophone, submitRecording]);

  const toggleVoice = useCallback(() => {
    if (voiceState === 'listening') {
      stopRecording();
      return;
    }
    if (voiceState === 'idle' || voiceState === 'error') {
      void startRecording();
    }
  }, [startRecording, stopRecording, voiceState]);

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') {
      recorder.onstop = null;
      recorder.stop();
    }
    releaseMicrophone();
    audioRef.current?.pause();
  }, [releaseMicrophone]);

  const copy = stateCopy[voiceState];
  const isLive = !['idle', 'error'].includes(voiceState);
  const canTap = ['idle', 'error', 'listening'].includes(voiceState);
  const tapHint = voiceState === 'listening'
    ? 'tap when finished'
    : canTap
      ? 'tap to speak'
      : 'working securely';

  return (
    <main className="shell">
      <audio ref={audioRef} autoPlay />

      <header className="masthead">
        <div className="wordmark">
          <span className="wordmark-mark" aria-hidden="true">E</span>
          <span>ErrandOS</span>
        </div>
        <div className={`connection-pill ${isLive ? 'is-live' : ''}`}>
          <span className="connection-dot" />
          {isLive ? 'live' : 'standby'}
        </div>
      </header>

      <section className="voice-stage" aria-live="polite">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>

        <button
          aria-label={voiceState === 'listening' ? 'Finish voice command' : 'Start voice command'}
          className={`voice-orb state-${voiceState}`}
          disabled={!canTap}
          onClick={toggleVoice}
          type="button"
        >
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="orb-core">
            <span className="wave" aria-hidden="true">
              <i /><i /><i /><i /><i />
            </span>
          </span>
        </button>

        <p className="assistant-copy">{assistantText}</p>
        <p className="tap-hint">{tapHint}</p>
      </section>

      <section className="activity-panel">
        <div className="activity-heading">
          <span>Activity</span>
          <span className="device-label">Pixel 9 · local</span>
        </div>
        <ol>
          {timeline.map((event) => (
            <li key={event.id} className={`tone-${event.tone}`}>
              <span className="event-marker" />
              <span>{event.label}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer>
        <span>Nothing paid happens without review.</span>
        <span className="footer-glyph" aria-hidden="true">↗</span>
      </footer>
    </main>
  );
}
