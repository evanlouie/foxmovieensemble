import Peaks from "peaks.js";
import React from "react";
import { Layer, Path, Rect, Stage } from "react-konva";
import ReactPlayer from "react-player";
import { stringToRGBA } from "./colour";
import { secondsToTime } from "./time";

export interface IMedia {
  title: string;
  sourceUrl?: string; // URL to either video, image, or audio file
  predictions: Array<IVideoPrediction | IAudioPrediction>;
  labels?: Array<IVideoLabel | IAudioLabel>;
  subtitles?: { [language: string]: string };
}

interface ILabel {
  classifier: string;
  time: number; // time in ms relative to 0:00:00.000 in source
}

interface IVideoLabel extends ILabel {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface IAudioLabel extends ILabel {
  duration: number; // duration in ms
}

interface IPrediction extends ILabel {
  confidence: number; // 0 - 100
  model?: string;
}

interface IVideoPrediction extends IPrediction, IVideoLabel {}

interface IAudioPrediction extends IPrediction, IAudioLabel {}

interface IAppState {
  volume: number;
  playing: boolean;
  playbackRate: number;
  classifications: { [classification: string]: boolean };
  predictionsByTime: { [seconds: number]: IPrediction[] | undefined };
  currentPlaybackTime: number;
  peakInstance?: Peaks.PeaksInstance;
  sourceUrl?: string;
  waveformReady: boolean;
  peaksError?: string;
  models: { [model: string]: boolean };
  predictions: IPrediction[];
}

class App extends React.Component<IMedia, IAppState> {
  public state: IAppState = {
    currentPlaybackTime: 0,
    playing: false,
    volume: 0.0,
    playbackRate: 1.0,
    sourceUrl: this.props.sourceUrl,
    waveformReady: false,
    predictions: [],
    models: {},
    classifications: {},
    predictionsByTime: {}
  };

  private playerRef = React.createRef<ReactPlayer>();
  private currentlyPlayingRefs: HTMLElement[] = [];
  private peaksContainerRef = React.createRef<HTMLDivElement>();
  private peaksAudioRef = React.createRef<HTMLAudioElement>();

  constructor(props: any) {
    super(props);
  }

  public componentDidMount() {
    const predictions = [
      ...this.props.predictions,
      ...(this.props.labels || []).map(p => {
        return { ...p, model: "Ground-Truth", confidence: 1.0 };
      })
    ].sort((a, b) => a.time - b.time);
    const models = [...new Set(predictions.map(p => p.model || ""))]
      .filter(e => e)
      .reduce((carry, model) => ({ ...carry, [model]: true }), {});
    const classifications = predictions.reduce(
      (categories, { classifier }) => ({ ...categories, [classifier]: true }),
      {}
    );
    const predictionsByTime = predictions.reduce<{
      [t: number]: IPrediction[];
    }>((carry, p) => {
      const timeS = Math.round(p.time / 1000);

      const seconds =
        "duration" in p
          ? Math.ceil((p as IAudioPrediction).duration / 1000)
          : 1;
      for (let i = 0; i < seconds; i++) {
        const time = timeS + i;
        carry[time] = carry[time] || [];
        carry[time].push(p);
      }
      return carry;
    }, {});
    this.setState({ predictions, models, classifications, predictionsByTime });
  }

  public componentDidUpdate() {
    // Ensure the first label in always in view
    this.currentlyPlayingRefs.slice(0, 1).forEach(el => {
      el.scrollIntoView({ block: "start" });
    });

    // Init peaks
    const peaksContainer = this.peaksContainerRef.current;
    const peaksMedia = this.peaksAudioRef.current;
    if (!this.state.peakInstance && peaksContainer && peaksMedia) {
      const { predictions } = this.state;
      const audioPredictions = predictions.filter(
        p => "time" in p && "duration" in p
      ) as IAudioPrediction[];
      const videoPredictions = predictions.filter(
        ({ x, y, width, height, time }: any) =>
          x && y && width && height && time
      ) as IVideoPrediction[];

      const audioSegments = audioPredictions.map(p => {
        return {
          startTime: p.time / 1000,
          endTime: p.time + p.duration / 1000,
          color: this.predictionColor(p),
          labelText: p.classifier
        };
      });

      const videoPoints = videoPredictions.map(p => {
        return {
          time: p.time / 1000,
          labelText: p.classifier
        };
      });

      const peakInstance = Peaks.init({
        container: this.peaksContainerRef.current as HTMLElement,
        mediaElement: this.peaksAudioRef.current as Element,
        audioContext: new AudioContext(),
        pointMarkerColor: "#006eb0",
        showPlayheadTime: true,
        segments: audioSegments,
        points: videoPoints
      });
      peakInstance.on("peaks.ready", () => {
        this.setState({ waveformReady: true });
      });
      peakInstance.on("error", (error: Error) => {
        alert(error);
        console.error(error);
        this.setState({
          peaksError: error.message,
          waveformReady: true
        });
      });

      this.setState({ peakInstance });

      peakInstance.on("player_seek", (e: number) => {
        const { current } = this.playerRef;
        if (current) {
          current.seekTo(e);
        }
      });
    }
  }
  public playPause = () => {
    console.log("play");
    this.setState({ playing: !this.state.playing });
  };

  public seek = (e: number) => {
    const { current } = this.playerRef;
    if (current) {
      current.seekTo(e);
    }
  };

  public setPlaybackRate = (rate: number) => {
    console.log("Setting playback rate: " + rate);
    this.setState({ playbackRate: rate });
  };

  public render() {
    this.currentlyPlayingRefs = [];
    const {
      volume,
      predictionsByTime,
      currentPlaybackTime,
      sourceUrl,
      waveformReady,
      peaksError,
      models,
      classifications,
      predictions
    } = this.state;
    const { title, subtitles } = this.props;

    const reactPlayer = this.playerRef.current;
    const duration = (reactPlayer && reactPlayer.getDuration()) || -1;
    const {
      videoWidth = -1,
      videoHeight = -1,
      offsetWidth = 640,
      offsetHeight = 360
    } =
      (reactPlayer && (reactPlayer.getInternalPlayer() as HTMLVideoElement)) ||
      {};
    const scaleX = offsetWidth / videoWidth;
    const scaleY = offsetHeight / videoHeight;

    const currentPredictions = (
      predictionsByTime[Math.round(currentPlaybackTime)] || []
    ).filter(p =>
      classifications[p.classifier] && "model" in p
        ? !!models[(p as IPrediction).model || ""]
        : true
    );
    const currentVideoPredictions = (currentPredictions.filter(
      ({ x, y, width, height, time }: any) => x && y && width && height && time
    ) as IVideoPrediction[]).filter(p => classifications[p.classifier]);
    const currentAudioPredictions = (currentPredictions.filter(
      ({ time, duration: pDuration }: any) => pDuration && time
    ) as IAudioPrediction[]).filter(p => classifications[p.classifier]);
    const hasModelMetadata = Object.keys(models).length > 0;

    return (
      <div
        className="App"
        style={{
          maxWidth: "100vw",
          maxHeight: "100vh",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <section
          id="header"
          style={{
            maxHeight: "100%",
            border: "1px dotted grey",
            flex: "1"
          }}
        >
          <h1>{title}</h1>
        </section>

        <div
          className="main"
          style={{
            flex: "1",
            display: "flex",
            flexFlow: "row nowrap",
            justifyContent: "space-around"
          }}
        >
          <section
            className="video-player"
            style={{ border: "1px dotted grey", flex: "1", maxHeight: "100%" }}
          >
            {/* If sourceUrl provided, present visualizations. Otherwise, show <input /> */}
            {sourceUrl ? (
              <div
                className="visualizations"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  maxHeight: "100%",
                  overflowY: "scroll"
                }}
              >
                <div
                  className="player-video"
                  style={{ position: "relative" }}
                  onClick={this.playPause}
                >
                  <ReactPlayer
                    width="100%"
                    height="100%"
                    muted={true}
                    ref={this.playerRef}
                    url={sourceUrl}
                    playing={this.state.playing}
                    controls={false}
                    config={{
                      file: {
                        tracks: subtitles
                          ? Object.keys(subtitles).map(language => {
                              return {
                                kind: "subtitles",
                                src: subtitles[language],
                                srcLang: language,
                                label: language
                              };
                            })
                          : []
                      }
                    }}
                    volume={volume}
                    onProgress={({ playedSeconds }) => {
                      this.setState({ currentPlaybackTime: playedSeconds });
                    }}
                    progressInterval={250}
                    onSeek={this.seek}
                    onPause={() => {
                      const { peakInstance } = this.state;
                      if (peakInstance) {
                        peakInstance.player.pause();
                      }
                    }}
                    onPlay={() => {
                      const { peakInstance } = this.state;
                      if (peakInstance) {
                        peakInstance.player.play();
                      }
                    }}
                  />
                  <Stage
                    width={videoWidth}
                    height={videoHeight}
                    scale={{ x: scaleX, y: scaleY }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      maxWidth: "100%",
                      maxHeight: "100%",
                      overflow: "hidden", // Generated canvas will be videoWidth x videoHeight even when scaled.
                      pointerEvents: "none"
                    }}
                  >
                    <Layer hitGraphEnabled={false}>
                      {currentVideoPredictions.map(p => {
                        const hasValidBoundingBox = p.width > 0 && p.height > 0;
                        const fill = this.predictionColor(p);
                        return [
                          hasValidBoundingBox && (
                            <Rect
                              key={JSON.stringify(p)}
                              x={p.x}
                              y={p.y}
                              width={p.width}
                              height={p.height}
                              name={p.classifier}
                              // fill={fill}
                              stroke={fill}
                            />
                          ),
                          <Path
                            fill={fill}
                            key={JSON.stringify(p) + "-icon"}
                            width={videoHeight / 10}
                            height={videoHeight / 10}
                            x={20}
                            y={20}
                            scale={{ x: 5, y: 5 }}
                            data="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-1.96-2.36L6.5 17h11l-3.54-4.71z"
                          />
                        ];
                      })}
                      {currentAudioPredictions.map(p => {
                        return (
                          <Path
                            fill={this.predictionColor(p)}
                            key={JSON.stringify(p)}
                            width={videoHeight / 10}
                            height={videoHeight / 10}
                            x={20}
                            y={40 + videoHeight / 10}
                            scale={{ x: 5, y: 5 }}
                            data="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM7.76 16.24l-1.41 1.41C4.78 16.1 4 14.05 4 12c0-2.05.78-4.1 2.34-5.66l1.41 1.41C6.59 8.93 6 10.46 6 12s.59 3.07 1.76 4.24zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm5.66 1.66l-1.41-1.41C17.41 15.07 18 13.54 18 12s-.59-3.07-1.76-4.24l1.41-1.41C19.22 7.9 20 9.95 20 12c0 2.05-.78 4.1-2.34 5.66zM12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                          />
                        );
                      })}
                    </Layer>
                  </Stage>
                </div>
                <div ref={this.peaksContainerRef} />
                <audio
                  controls
                  onPlay={() => this.setState({ playing: true })}
                  onPause={() => this.setState({ playing: false })}
                  ref={this.peaksAudioRef}
                  onSeeking={() => this.setState({ playing: true })}
                  style={{
                    width: "100%",
                    display: waveformReady ? "none" : "unset"
                  }}
                >
                  <source src={sourceUrl} type="audio/mpeg" />
                </audio>
                {!waveformReady && (
                  <code>
                    Generating audio waveform. May take a long time depending on
                    media length...
                  </code>
                )}
                {peaksError && <pre>ERROR: {peaksError}</pre>}
                <audio ref={this.peaksAudioRef}>
                  <source src={sourceUrl} type="audio/mpeg" />
                </audio>
              </div>
            ) : (
              // Allow user to input media from local filesystem
              <figure>
                <figcaption>
                  No MediaFile <code>url</code> found associated with with{" "}
                  <code>{title}</code>. Select local media file to underlay
                  labels.
                </figcaption>
                <input
                  type="file"
                  accept="video/*"
                  onChange={ev => {
                    const { files } = ev.currentTarget;
                    if (files) {
                      const file = files[0];
                      this.setState({
                        sourceUrl: URL.createObjectURL(file)
                      });
                    }
                  }}
                />
              </figure>
            )}
          </section>
          <section
            style={{
              overflowY: "scroll",
              border: "1px dotted grey",
              flex: "1"
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-around"
              }}
            >
              <div className="classifications">
                <h4>Classifiers</h4>
                {Object.keys(classifications).map(c => {
                  return (
                    <div key={JSON.stringify(c)}>
                      <input
                        type="checkbox"
                        checked={classifications[c]}
                        onChange={e => {
                          this.setState({
                            classifications: {
                              ...classifications,
                              [c]: e.currentTarget.checked
                            }
                          });
                        }}
                      />
                      <span
                        style={{
                          color: stringToRGBA(c, {
                            alpha: 1
                          })
                        }}
                      >
                        {c}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="models">
                <h4>Models</h4>
                {Object.keys(models).map(m => {
                  return (
                    <div key={JSON.stringify(m)}>
                      <input
                        type="checkbox"
                        checked={models[m]}
                        onChange={e => {
                          this.setState({
                            models: {
                              ...models,
                              [m]: e.currentTarget.checked
                            }
                          });
                        }}
                      />
                      <span
                        style={{
                          color: stringToRGBA(m, {
                            alpha: 1
                          })
                        }}
                      >
                        {m}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <table style={{ border: "1px dotted grey", width: "100%" }}>
              <thead>
                <tr>
                  <th>Time (ms)</th>
                  <th>Classifier</th>
                  {hasModelMetadata && <th>Model</th>}
                  <th>Confidence</th>
                  <th>Video/Audio</th>
                  <th>Button</th>
                </tr>
              </thead>
              <tbody>
                {predictions
                  .filter(p =>
                    classifications[p.classifier] && "model" in p
                      ? models[p.model || ""]
                      : true
                  )
                  .map(prediction => {
                    const isAudio = "duration" in prediction;
                    const isPlaying =
                      Math.round(prediction.time / 1000) ===
                      Math.round(currentPlaybackTime);
                    const formatTime = (seconds: number) =>
                      secondsToTime(seconds, { useColons: true });
                    const timeCode = isAudio
                      ? formatTime(prediction.time / 1000) +
                        " - " +
                        formatTime(
                          ((prediction as IAudioPrediction).duration +
                            prediction.time) /
                            1000
                        )
                      : formatTime(prediction.time / 1000);
                    const play = <T extends {}>(_: React.MouseEvent<T>) => {
                      const { current } = this.playerRef;
                      const { peakInstance } = this.state;
                      if (current) {
                        const fraction = prediction.time / 1000 / duration;
                        current.seekTo(fraction);
                      }
                      if (peakInstance) {
                        peakInstance.player.seek(prediction.time / 1000);
                      }
                    };
                    const ref = (r: HTMLSpanElement | null) => {
                      if (isPlaying && r) {
                        this.currentlyPlayingRefs.push(r);
                      }
                    };
                    const confidence =
                      "confidence" in prediction
                        ? (prediction as IPrediction).confidence
                        : "1.00";
                    const model =
                      "model" in prediction
                        ? (prediction as IPrediction).model || "---"
                        : "Ground-Truth";

                    return (
                      <tr
                        style={{
                          background: isPlaying ? "lightgrey" : "unset",
                          color: this.predictionColor(prediction)
                        }}
                        key={JSON.stringify(prediction)}
                        ref={ref}
                      >
                        <td>
                          <code>{timeCode}</code>
                        </td>
                        <td
                          style={{
                            color: this.predictionColor(prediction)
                          }}
                        >
                          <code>{prediction.classifier}</code>
                        </td>

                        {hasModelMetadata && (
                          <td>
                            <code>{model}</code>
                          </td>
                        )}
                        <td>
                          <code>{confidence}</code>
                        </td>
                        <td>
                          <code>
                            {"duration" in prediction
                              ? "Audio"
                              : (prediction as IVideoPrediction).width > 0
                              ? "Video"
                              : "Video (No Box)"}
                          </code>
                        </td>
                        <td>
                          <button onClick={play}>Seek</button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    );
  }

  private predictionColor = (p: IPrediction): string =>
    stringToRGBA(p.classifier + p.model, { alpha: 1 });
}

export default App;
