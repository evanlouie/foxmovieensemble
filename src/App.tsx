import React, { Component } from 'react';
import * as ReactDOM from 'react-dom';
import './App.css';
import ReactPlayer from 'react-player'
import {Stage, Layer, Rect, Transformer } from 'react-konva'
import WaveSurfer, { WaveSurferInstance } from "wavesurfer.js"
import MinimapPlugin from "wavesurfer.js/dist/plugin/wavesurfer.minimap.js"
import RegionsPlugin, {Region, WaveSurferRegions, RegionInitializationProps,} from "wavesurfer.js/dist/plugin/wavesurfer.regions.js"
import { dragDistance } from 'konva';
import { S_IFCHR } from 'constants';


const movies = {
  sintelTrailer: 'http://media.w3.org/2010/05/sintel/trailer.mp4',
//  bunnyTrailer: 'http://media.w3.org/2010/05/bunny/trailer.mp4',
 // bunnyMovie: 'http://media.w3.org/2010/05/bunny/movie.mp4',
  deadpool: 'https://www.youtube.com/watch?v=ONHBaC-pfsk',
};


const audioclips = {
  sampleAudio: 'http://ia902606.us.archive.org/35/items/shortpoetry_047_librivox/song_cjrg_teasdale_64kb.mp3'
};

const deadpool: IMedia<IVideoPrediction> = {
  title: 'Deadpool 2',
  sourceUrl: 'https://www.youtube.com/watch?v=D86RtevtfrA',
  predictions: [{classifier: 'violence', confidence: 1, xStart: 0, yStart: 0, xEnd: 100, yEnd: 100, time: 3, },
                {classifier: 'violence', confidence: 2, xStart: 100, yStart: 100, xEnd: 200, yEnd: 200, time: 7, },
                {classifier: 'nudity', confidence: 4, xStart: 100, yStart: 100, xEnd: 200, yEnd: 200, time: 10},
                {classifier: 'violence', confidence: 3, xStart: 100, yStart: 100, xEnd: 200, yEnd: 200, time: 15, },
                {classifier: 'deadpool', confidence: 5, xStart: 200, yStart: 200, xEnd: 300, yEnd: 300, time: 12},
                {classifier: 'deadpool', confidence: 6, xStart: 200, yStart: 200, xEnd: 300, yEnd: 300, time: 14}
              ],
}

const sampleAudio: IMedia<IAudioPrediction> = {
  title: 'Test Audio',
  sourceUrl: 'http://ia902606.us.archive.org/35/items/shortpoetry_047_librivox/song_cjrg_teasdale_64kb.mp3',
  predictions: [{classifier: 'stronglanguage',confidence:1, time:3,duration:2,},
                {classifier: 'loud', confidence:1, time:7,duration:3,}
              ],
}
interface IMedia<PredictionTypes extends IVisualPrediction | IVideoPrediction | IAudioPrediction> {
  title: string
  sourceUrl: string // URL to either video, image, or audio file
  predictions: PredictionTypes[]
}

interface IPrediction {
  classifier: string
  confidence: number // 0 - 100
}

interface IVisualPrediction extends IPrediction {
  xStart: number // top left x
  yStart: number // top left y
  xEnd: number // bottom right x
  yEnd: number // bottom right y
}

interface IVideoPrediction extends IVisualPrediction {
  time: number // time in ms relative to 0:00:00.000 in source
}

interface IAudioPrediction extends IPrediction {
  time: number // time in ms relative to 0:00:00.000 in source
  duration: number // duration in ms
}

class App extends React.Component { 
  constructor(props: any) {
    super(props);
  }

  private player!:ReactPlayer;

  private audioPlayer!:WaveSurferInstance & WaveSurferRegions;
  

  state: { media:IMedia<IVideoPrediction>,
          played:number, loaded:number, playing: boolean, url:string, 
          volume:number, loop: boolean, duration: number, playbackRate: number, loadedSeconds: number,
          playedSeconds: number, boxHeight: number, boxWidth: number, isDragging: boolean, categories: Array<string>, 
          mediamap : {[key:number]:IVideoPrediction}, audio:IMedia<IAudioPrediction>, audiomap:{[key:number]:IAudioPrediction},
          displayBox: boolean, color: string, time: number} = {

      played: 0,
      loaded: 0,
      playing: true,
      url: '', // url: null,
      volume: 0.8,
      loop: true,
      duration: 0,
      playbackRate: 1.0,
      loadedSeconds: 0,
      playedSeconds: 0,
      boxHeight: 100,
      boxWidth: 100,
      isDragging: false,
      categories: deadpool.predictions.map(a => a.classifier),
      media: deadpool,
      audio: sampleAudio,
      mediamap: {},
      audiomap: {},
      displayBox: false,
      color: '',
      time: 0,
  } 


  componentDidMount() {

    console.log("Start of Mount");
  
    this.audioPlayer = WaveSurfer.create({
      container: "#audiocontainer",
      hideScrollbar: false,
      loopSelection: true,
      progressColor: "purple",
      responsive: true,
      scrollParent: true,
      waveColor: "red",
      plugins: [
        MinimapPlugin.create(),
        RegionsPlugin.create({dragSelection:true}),
      ],}) as WaveSurferInstance & WaveSurferRegions;     
      console.log("end of Mount");
      
  }

  componentDidUpdate() {
  }

  playPauseAudio = () => {
    console.log("Play pause audio")
    this.audioPlayer.playPause();
  }

  LoadAudio = () => {
    console.log("Init audio")
    this.LoadAudioInPlayer()
  }

  playPause = () => {
    console.log('play/pause')
    this.setState({ playing: !this.state.playing })

    //plays a default movie if none is selected
    if(this.state.url === '') {
      this.setMovieUrl(movies.sintelTrailer)
    }
  }

  onPlay = () => {
    console.log('onPlay')
    this.setState({ playing: true })
    this.audioPlayer.playPause()
  }
  onPause = () => {
    console.log('onPause')
    this.setState({ playing: false })
    this.audioPlayer.playPause()
  }

  OnSeek = (e: number) => {
    console.log("seeeeeking")
    this.player.seekTo(e);
  }
  
  onSeekMouseDown = (e:any) => {
    this.setState({ seeking: true })
  }
  onSeekChange = (e:any) => {
    this.setState({ played: parseFloat(e.target.value) })
  }
  onSeekMouseUp = (e:any) => {
    this.setState({ seeking: false })
    this.player.seekTo(parseFloat(e.target.value))
  }

  onProgress = (state : {playedSeconds: number , loadedSeconds: number, played: number}) => {
    //console.log('onProgress ', state)
    // console.log("secs: " + state.playedSeconds);    
    var roundedPlayedSec = Math.round(this.state.playedSeconds)

    this.setState({loadedSeconds: state.loadedSeconds, playedSeconds: state.playedSeconds, time: roundedPlayedSec})

    //displays the correct bounding box based on time
    var i;
    var finishTime;
    var currentPrediction;
    for (i=0; i < deadpool.predictions.length; i++) {
      finishTime = deadpool.predictions[i].time + 2;
      if (deadpool.predictions[i].time === roundedPlayedSec) {
        this.setState({displayBox: true})
        console.log("can display bounding box " + deadpool.predictions[i].confidence + "? = " + this.state.displayBox)
        console.log(this.state.mediamap[roundedPlayedSec]);
      }
      if(finishTime === roundedPlayedSec) {
        this.setState({displayBox: false})
        console.log("End display of box " + deadpool.predictions[i].confidence)
      }
    }



    //check if current prediction is null
    //if not, print out the currentprediction on the side (classifier, and current xtart, ystart, and show that specific bounding )
    // currentPrediction = this.state.mediamap[roundedPlayedSec];
    // {
    //  console.log(currentPrediction.classifier);
    //   //console.log(currentPrediction.confidence);
    //   //console.log(currentPrediction.time);
    // }

    

   }

    
 

  setPlaybackRate = (e: number) => {
    console.log(e)
    this.state.playbackRate = e;
    this.setState({ playingbackRate: e })
  }
  createMapofTagsForMovie = () => {
    console.log('createMapOfTagsForMovie')
    //The value might need to be Array<string> if we can have more than one classifier at a particular time of the video
    deadpool.predictions.map(a=> this.state.mediamap[a.time]=a)
    
  }

  createMapofTagsForAudio = () => {
    console.log('createMapOfTagsForAudio')
    //The value might need to be Array<string> if we can have more than one classifier at a particular time of the video
    sampleAudio.predictions.map(a=> this.state.audiomap[a.time]=a)
    
  }

  displayaudiotag = (e:string) => {
    console.log("display tag");
    return (
      <body text="white">
      <tr>{e}</tr>
      </body>
    );

  
  }

  addRegionFunc = () => {
    let options, i;
    console.log("Start of add regions")
    for (i=0;i<sampleAudio.predictions.length;i++)
    {
      let newRegion:Region;
          options = {
            start: sampleAudio.predictions[i].time,
            end: sampleAudio.predictions[i].time +sampleAudio.predictions[i].duration,
            color: "orange",
           };
           console.log(options.start)
           console.log(options.end)
           newRegion = this.audioPlayer.addRegion(options);
           newRegion.id = sampleAudio.predictions[i].classifier;
     }
     this.audioPlayer.on("region-in",(r) => {
      //this.displayaudiotags(r)
      console.log("region in")
      
      let options = {
        start: r.start,
        end: r.end,
        color: "yellow",
        };
    this.audioPlayer.addRegion(options);
    const domContainer = document.querySelector('#audiotag');
    ReactDOM.render(this.displayaudiotag(this.state.audiomap[r.start].classifier), domContainer);
    })

    this.audioPlayer.on("region-out",(r) => {
      //this.undisplayaudiotags(r)
      console.log("region out")
      let options = {
        start: r.start,
        end: r.end,
        color: "orange",
        };
  
    this.audioPlayer.addRegion(options);
    const domContainer = document.querySelector('#audiotag');
    let e:string = ""
    ReactDOM.render(this.displayaudiotag(""), domContainer);
    })
  }

  

  undisplayaudiotags = (r:Region) => {
    console.log("in region out")
    r.id = "";
  }

  highlightregion = (time:number) => {
    let options = {
      start: this.state.audiomap[time].time,
      end: this.state.audiomap[time].time +this.state.audiomap[time].duration,
      color: "red",
  };

  this.audioPlayer.addRegion(options);
}
  

  LoadAudioInPlayer = () => {
    console.log("Loading movie in audioplayer");
    this.audioPlayer.load(sampleAudio.sourceUrl)
    this.createMapofTagsForAudio()  
    
    this.audioPlayer.on("ready",() =>{
      this.addRegionFunc()
    })

    this.audioPlayer.playPause();

  }

  setMovieUrl = (r: string ) => {
    console.log(r)
       this.state.url = r;
    this.setState({ url: r })
    //this.createMapofTagsForMovie()
   
  }


  boundingBoxClicked() {
    console.log("video clicked")

  }

  handleTransform = () => {
    console.log("transforming.....");
  }
  // onSearch = (event: any) => {
  //   console.log("searching tags....")
  // }


  render() {
    const { url, playing, volume, loaded, duration, playbackRate, played } = this.state


    var unique = this.state.categories.filter(function(value, index, self) {
      return self.indexOf(value) === index;
    })

    console.log("unique array: " + unique);
    let i=0;
    let j=0;
    let data;
    for (i=0; i<unique.length; i++) {
      console.log("category " + unique[i])
      for (j=0; j < deadpool.predictions.length; j++ ) {
          console.log("confidence " + deadpool.predictions[j].confidence);
          if(deadpool.predictions[j].classifier === unique[i]) {
            console.log("these are the same: " + deadpool.predictions[j].classifier + " and " + unique[i])
            data = deadpool.predictions[j];
            console.log("classifier: " + data.classifier + ", confidence: " + data.confidence + ", time: " + data.time)
          }
      }
    } 



    return (                

      <div className ='app'>
      <section id="header">
        <div id="title">
          <h1>Fox Movie Ensemble</h1>
        </div>
      </section>
        <section className='videoPlayer' id="videoplayer">
          <div className='player-wrapper' id="player-wrapper">
            <div id="videocontainer">
            
              <ReactPlayer
                  className = 'react-player'
                  url = {url} 
                  playing = {playing}
                  volume = {volume}
                  playbackRate = {playbackRate}
                  onProgress = {this.onProgress}
                  onSeek={e => console.log('onSeek', e)}
                  onStart={() => console.log('onStart')}


              />
              <Stage width={640} height={360} className="konvastage">
                <Layer>
                  { 
                    this.state.media.predictions.map((prediction) => {return <Rect
                      x= {prediction.xStart}
                      y= {prediction.yStart}
                      width={prediction.xEnd - prediction.xStart} 
                      height={prediction.yEnd - prediction.yStart} 
                      draggable 
                      name="myRect"
                      visible={this.state.time === Math.round(prediction.time)}
                      fill={this.state.isDragging ? 'red' : 'transparent'}
                      stroke="black"
                      //stroke = prediction.classifier
                      onDragStart={() => {  
                        this.setState({ isDragging: true });
                        console.log("Dragging started!");
                        console.log("Time: " + prediction.time);
                        console.log("Confidence: " + prediction.confidence);
                      }}
                      onDragEnd={() => { this.setState({ isDragging: false });
                        console.log("Done dragging!");                          
                      }}
                      onTransformStart={() => {
                      }}
                      />})    
                  }
                </Layer>
              </Stage>
            </div>
          </div>  
          <div  id="audiocontainer"></div>

                  
          <h2>Settings</h2>
          <h2 id="settings">Settings</h2>
          <table id="controls">
            <tbody>
              <tr>
                <th>Controls</th>
                <td>
                  <button onClick={this.playPause}> Play/Pause</button>
                </td>
                <td>
                  <button onClick={this.playPauseAudio}> Play/Pause Audio</button>
                </td>
                <td>
                  <button onClick={this.LoadAudio}> Init Audio</button>
                </td>
              </tr>
              <tr>
                <th>Playback</th>
                <td>
                  <button onClick={()=> this.setPlaybackRate(.5)}>.5</button>
                  <button onClick={()=> this.setPlaybackRate(1)}>1</button>
                  <button onClick={() => this.setPlaybackRate(2)}>2</button>
                </td>
              </tr>
              {/*
              <tr>
                <th>Skip</th>
                <td>
                  <button onClick={() => this.OnSeek(-1)}>Previous Frame</button>
                  <button onClick={() => this.OnSeek(1)}>Next Frame</button>
                  <button onClick={() => this.OnSeek(.5)}>test Frame</button>
                  <input
                  type='range' min={0} max={1} step='any'
                  value={played}
                  onMouseDown={this.onSeekMouseDown}
                  onChange={this.onSeekChange}
                  onMouseUp={this.onSeekMouseUp}
                />
                </td>
              </tr>
              */}
            </tbody>
          </table>
          <h2>State</h2>
          <table id="time">
            <tbody>
              <tr>
                <th>Seconds Ellapsed: </th>
                <td> {this.state.playedSeconds} </td>
              </tr>
              <tr>
                <th>Loaded:</th>
                <td> {this.state.loadedSeconds} </td>
              </tr>
            </tbody>
          </table>
          <h2>Movies</h2>
            <table id = 'movies'> 
              <tbody>
                <tr>
                  <th>Sintel Trailer</th>
                  <td> 
                    <button onClick={() => this.setMovieUrl(movies.sintelTrailer)}>Play</button>
                  </td>
                </tr>
                <tr>
                  <th>Deadpool Trailer</th>
                  <td>
                    <button onClick={() => this.setMovieUrl(movies.deadpool)}>Play</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
          <section id="tags">
            <div>
              <h2 id="tagheader">Tags</h2>
              <table id="tagtable">
              <thead>
                <tr> 
                  <th>Time</th>
                  <th>Classifier</th>
                  <th>Button</th>
                </tr>
              </thead>
                <tbody> 
                  {this.state.media.predictions.map((prediction) => {return <tr>
                      <td>{prediction.time}</td>
                      <td> {prediction.classifier} </td>
                      <td>
                        <button onClick={a => {
                          this.setState({time: prediction.time})
                          this.setState({})
                      }}> View </button>
                      </td>
                    </tr>
                  })}
                </tbody>
              </table>
            </div>
              <h2 id="audiotags">Audio Tags</h2>
              <div id="audiotag"></div>
              
            </section>
          <section id="footer">
            <div id="title">
            </div>
           </section>
      </div>
      ) 
   }
}



export default App;
