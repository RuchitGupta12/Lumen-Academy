import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';

/** Rendered inside the room so `useTracks` can read the room context. */
function Stage() {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }, { source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false },
  );

  return (
    <div className="flex h-full flex-col bg-[#05070A]">
      <div className="min-h-0 flex-1">
        <GridLayout tracks={tracks} className="h-full">
          <ParticipantTile />
        </GridLayout>
      </div>
      <ControlBar variation="minimal" />
      <RoomAudioRenderer />
    </div>
  );
}

/**
 * WebRTC room powered by LiveKit. Only loaded when the API reports the
 * `livekit` driver, so the simulated demo path keeps a small bundle.
 */
export function LiveKitStage({ url, token }: { url: string; token: string }) {
  return (
    <LiveKitRoom
      serverUrl={url}
      token={token}
      connect
      video
      audio
      className="overflow-hidden rounded-xl border border-line"
      style={{ height: 560 }}
    >
      <Stage />
    </LiveKitRoom>
  );
}
