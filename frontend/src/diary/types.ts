export type DiaryTheme = "vintage" | "neon" | "cottage" | "studio";

export type Mood = "happy" | "neutral" | "sad" | "excited" | "anxious";

export type AttachmentType = "image" | "video" | "audio";

export type DiaryAttachment = {
  id: string;
  type: AttachmentType;
  name: string;
  dataUrl: string;
  caption: string;
  createdAt: string;
  rotation: number;
};

export type DiaryMoment = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  mood: Mood;
  attachments: DiaryAttachment[];
  locked: boolean;
};

export type DiaryDay = {
  date: string;
  entries: DiaryMoment[];
};

export type DiaryState = {
  title: string;
  year: number;
  theme: DiaryTheme;
  days: DiaryDay[];
  pinHash: string | null;
};
