"use client"
import React, { useState, useRef, useEffect } from 'react';
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff, Monitor, Copy, Users } from 'lucide-react';

const WebRTCApp = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionId, setConnectionId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [status, setStatus] = useState('Ready to connect');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const datachannel = useRef(null);

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    // Generate a simple connection ID
    setConnectionId(Math.random().toString(36).substr(2, 9));
    initializeMedia();
    
    return () => {
      cleanup();
    };
  }, []);

  const initializeMedia = async () => {
    try {
      const stream = await navigator?.mediaDevices?.getUserMedia({
        video: true,
        audio: true
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setStatus('Camera and microphone ready');
    } catch (error) {
      setStatus('Error accessing media devices');
      console.error('Error accessing media devices:', error);
    }
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(configuration);
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // In a real app, you'd send this to the other peer via signaling server
        console.log('ICE candidate:', event.candidate);
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setIsConnected(true);
      setStatus('Connected to peer');
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onmessage = (event) => {
        console.log('Received message:', event.data);
      };
    };

    pc.onconnectionstatechange = () => {
      setStatus(`Connection state: ${pc.connectionState}`);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setIsConnected(false);
      }
    };

    return pc;
  };

  const startCall = async () => {
    try {
      peerConnectionRef.current = createPeerConnection();
      
      // Add local stream to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnectionRef.current.addTrack(track, localStreamRef.current);
        });
      }

      // Create data channel
      datachannel.current = peerConnectionRef.current.createDataChannel('messages');
      
      // Create offer
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      setStatus('Call initiated - Share your connection details');
      console.log('Offer created:', offer);
      
      // In a real app, you'd send the offer to the other peer
      // For this demo, we'll show it in the console
      
    } catch (error) {
      setStatus('Error starting call');
      console.error('Error starting call:', error);
    }
  };

  const answerCall = async () => {
    try {
      peerConnectionRef.current = createPeerConnection();
      
      // Add local stream to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnectionRef.current.addTrack(track, localStreamRef.current);
        });
      }

      // In a real app, you'd receive the offer from the other peer
      // For this demo, we'll simulate it
      setStatus('Answering call...');
      
    } catch (error) {
      setStatus('Error answering call');
      console.error('Error answering call:', error);
    }
  };

  const endCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setIsConnected(false);
    setStatus('Call ended');
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        // Replace video track
        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find(
            s => s.track && s.track.kind === 'video'
          );
          if (sender) {
            await sender.replaceTrack(screenStream.getVideoTracks()[0]);
          }
        }
        
        localVideoRef.current.srcObject = screenStream;
        setIsScreenSharing(true);
        
        screenStream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };
      } else {
        stopScreenShare();
      }
    } catch (error) {
      console.error('Error with screen sharing:', error);
    }
  };

  const stopScreenShare = async () => {
    if (localStreamRef.current) {
      // Replace with camera stream
      if (peerConnectionRef.current) {
        const sender = peerConnectionRef.current.getSenders().find(
          s => s.track && s.track.kind === 'video'
        );
        if (sender) {
          await sender.replaceTrack(localStreamRef.current.getVideoTracks()[0]);
        }
      }
      
      localVideoRef.current.srcObject = localStreamRef.current;
      setIsScreenSharing(false);
    }
  };

  const copyConnectionId = () => {
    navigator.clipboard.writeText(connectionId);
    setStatus('Connection ID copied to clipboard');
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">WebRTC Video Call</h1>
        
        {/* Status Bar */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Status: {status}</span>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-300">Your ID: {connectionId}</span>
              <button
                onClick={copyConnectionId}
                className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Connection Controls */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder="Enter peer ID to connect"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="flex-1 p-2 bg-gray-700 rounded-lg text-white"
            />
            <button
              onClick={startCall}
              disabled={isConnected}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg flex items-center space-x-2"
            >
              <Phone className="w-4 h-4" />
              <span>Start Call</span>
            </button>
            <button
              onClick={answerCall}
              disabled={isConnected}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg flex items-center space-x-2"
            >
              <Users className="w-4 h-4" />
              <span>Answer</span>
            </button>
          </div>
        </div>

        {/* Video Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Local Video */}
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="bg-gray-700 p-3">
              <h3 className="font-semibold">You {isScreenSharing ? '(Screen)' : '(Camera)'}</h3>
            </div>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-64 object-cover"
            />
          </div>

          {/* Remote Video */}
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="bg-gray-700 p-3">
              <h3 className="font-semibold">Remote Peer</h3>
            </div>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-64 object-cover"
            />
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full ${isVideoEnabled ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>
          
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full ${isAudioEnabled ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>
          
          <button
            onClick={toggleScreenShare}
            className={`p-4 rounded-full ${isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'}`}
          >
            <Monitor className="w-6 h-6" />
          </button>
          
          <button
            onClick={endCall}
            disabled={!isConnected}
            className="p-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-full"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">How to use:</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Allow camera and microphone access when prompted</li>
            <li>Share your Connection ID with the person you want to call</li>
            <li>Enter their Connection ID and click &quot;Start Call&quot; or "Answer"</li>
            <li>Note: This is a basic demo - in a real app, you&apos;d need a signaling server</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default WebRTCApp;