import { FileVideo, Upload } from "lucide-react";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { api } from "@/lib/axios";

type Status = "waiting" | "converting" | "uploading" | "generating" | "success";

const statusMessages = {
  converting: "Convertendo...",
  generating: "Transcrevendo...",
  uploading: "Carregando...",
  success: "Sucesso!",
};

export function VideoInputForm() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState<Status>("waiting");

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const { files } = event.currentTarget;

    if (!files) return;

    const selectedFile = files[0];
    setVideoFile(selectedFile);
  }

  async function handleUploadVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("converting");

    const prompt = promptInputRef.current?.value;

    if (!videoFile) return;

    // converter o video em audio
    const audio = await converVideoToAudio(videoFile);

    const data = new FormData();

    data.append("file", audio);
    setStatus("uploading");

    const response = await api.post("/videos", data);
    const videoId = response.data.video.id;
    setStatus("generating");

    await api.post(`/videos/${videoId}/transcription`, {
      prompt,
    });

    setStatus("success");

    console.log("Finalizou");
  }

  async function converVideoToAudio(video: File) {
    console.log("Convert started.");
    const ffmpeg = await getFFmpeg();
    await ffmpeg.writeFile("input.mp4", await fetchFile(video));

    // ffmpeg.on("log", console.log);

    ffmpeg.on("progress", (progress) => {
      console.log(
        "Convert progress: " + Math.round(progress.progress * 100) + "%"
      );
    });

    await ffmpeg.exec([
      "-i",
      "input.mp4",
      "-map",
      "0:a",
      "-b:a",
      "20k",
      "-acodec",
      "libmp3lame",
      "output.mp3",
    ]);

    const data = await ffmpeg.readFile("output.mp3");

    const audioFileBlob = new Blob([data], { type: "audio/mpeg" });
    const audioFile = new File([audioFileBlob], "audio.mp3", {
      type: "audio/mpeg",
    });

    console.log("Convert finished");

    return audioFile;
  }

  const previewUrl = useMemo(() => {
    if (!videoFile) {
      return null;
    }

    return URL.createObjectURL(videoFile);
  }, [videoFile]);

  return (
    <form className="space-y-6 w-full" onSubmit={handleUploadVideo}>
      <label
        htmlFor="video"
        className="border flex rounded-md aspect-video cursor-pointer border-dashed text-sm flex-col items-center justify-center text-muted-foreground hover:bg-primary/5 relative"
      >
        {previewUrl ? (
          <video
            src={previewUrl}
            controls={false}
            className="pointer-events-none absolute inset-0"
          />
        ) : (
          <>
            <FileVideo className="w-4 h-4" />
            Selecione um vídeo
          </>
        )}
      </label>
      <input
        type="file"
        id="video"
        accept="video/mp4"
        className="sr-only"
        onChange={handleFileSelected}
      />

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="transcription_area">Prompt de transcrição</Label>
        <Textarea
          disabled={status !== "waiting"}
          ref={promptInputRef}
          id="transcription_area"
          className="resize-none h-20 leading-relaxed"
          placeholder="Inclua palavras chaves no vídeo separadas por vírgula(,)"
        />
        <Button
          type="submit"
          className="w-full"
          disabled={status !== "waiting"}
        >
          {status === "waiting" ? (
            <>
              <Upload className="h-4 w-4 ml-2" />
              Carregar Video
            </>
          ) : (
            statusMessages[status]
          )}
        </Button>
      </div>
    </form>
  );
}
