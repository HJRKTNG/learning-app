import React, { useEffect, useRef, useState } from 'react';
import '../web/cameraCapture.css';
import { CapturedAnswer } from '../services/gradingService';

type CameraCaptureProps = {
  manualAnswer: string;
  onCapture: (answer: CapturedAnswer) => void;
};

export function CameraCapture({ manualAnswer, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('このブラウザではカメラAPIを利用できません。画像アップロードを使ってください。');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
          },
        });
        if (!active) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setCameraError('カメラを開始できませんでした。権限を確認するか、画像をアップロードしてください。');
      }
    };

    startCamera();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const emitCapture = (imageDataUrl?: string, imageName?: string) => {
    onCapture({
      imageDataUrl,
      imageName,
      manualAnswer,
      ocrText: manualAnswer,
    });
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      emitCapture(undefined, 'manual-answer');
      return;
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0, width, height);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.86);
    setPreviewUrl(imageDataUrl);
    emitCapture(imageDataUrl, 'camera-answer.jpg');
  };

  const uploadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl =
        typeof reader.result === 'string' ? reader.result : undefined;
      setPreviewUrl(imageDataUrl ?? null);
      emitCapture(imageDataUrl, file.name);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="camera-capture">
      <div className="camera-view">
        {previewUrl ? (
          <img alt="撮影した答案" className="camera-preview" src={previewUrl} />
        ) : (
          <video
            aria-label="答案撮影カメラ"
            className="camera-video"
            muted
            playsInline
            ref={videoRef}
          />
        )}
        <div className="camera-frame">
          <span>解答用紙を枠内に合わせる</span>
        </div>
      </div>
      {cameraError ? <p className="camera-error">{cameraError}</p> : null}
      <div className="camera-actions">
        <label className="camera-file-button">
          画像を選ぶ
          <input accept="image/*" onChange={uploadFile} type="file" />
        </label>
        <button className="camera-shutter" onClick={captureFrame} type="button">
          撮影
        </button>
      </div>
      <canvas aria-hidden="true" className="camera-canvas" ref={canvasRef} />
    </div>
  );
}
