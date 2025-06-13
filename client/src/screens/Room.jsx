import React, { useEffect, useCallback, useState } from "react";
import ReactPlayer from "react-player";
import peer from "../service/peer";
import { useSocket } from "../context/SocketProvider";

const RoomPage = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [mediaError, setMediaError] = useState(null);

  // Add test function
  const testMediaDevices = async () => {
    try {
      // Check if we're in a secure context
      const isSecureContext = window.isSecureContext;
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';
      
      if (!isSecureContext && !isLocalhost) {
        throw new Error(
          "Media devices require a secure context (HTTPS) when not using localhost. " +
          "Please use localhost:5173 instead of IP address, or enable HTTPS."
        );
      }

      if (!navigator.mediaDevices) {
        throw new Error("mediaDevices not supported in this browser");
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideo = devices.some(device => device.kind === 'videoinput');
      const hasAudio = devices.some(device => device.kind === 'audioinput');
      
      console.log('Available devices:', devices);
      console.log('Has video device:', hasVideo);
      console.log('Has audio device:', hasAudio);
      
      if (!hasVideo || !hasAudio) {
        throw new Error("No camera or microphone found");
      }
      
      // Test actual access
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(track => track.stop()); // Clean up
      
      return true;
    } catch (error) {
      console.error('Media device test failed:', error);
      setMediaError(error.message);
      return false;
    }
  };

  useEffect(() => {
    testMediaDevices();
  }, []);

  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room`);
    setRemoteSocketId(id);
  }, []);

  const handleCallUser = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Media devices not supported in this browser or context");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      const offer = await peer.getOffer();
      socket.emit("user:call", { to: remoteSocketId, offer });
      setMyStream(stream);
    } catch (error) {
      console.error("Error accessing media devices:", error);
      setMediaError(error.message);
    }
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Media devices not supported in this browser or context");
        }
        setRemoteSocketId(from);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        setMyStream(stream);
        console.log(`Incoming Call`, from, offer);
        const ans = await peer.getAnswer(offer);
        socket.emit("call:accepted", { to: from, ans });
      } catch (error) {
        console.error("Error accessing media devices:", error);
        setMediaError(error.message);
      }
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    for (const track of myStream.getTracks()) {
      peer.peer.addTrack(track, myStream);
    }
  }, [myStream]);

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      peer.setLocalDescription(ans);
      console.log("Call Accepted!");
      sendStreams();
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.setLocalDescription(ans);
  }, []);

  useEffect(() => {
    peer.peer.addEventListener("track", async (ev) => {
      const remoteStream = ev.streams;
      console.log("GOT TRACKS!!");
      setRemoteStream(remoteStream[0]);
    });
  }, []);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
  ]);

  return (
    <div>
      <h1>Room Page</h1>
      {mediaError ? (
        <div style={{ color: 'red', padding: '20px' }}>
          <h3>Error: {mediaError}</h3>
          <p>To fix this:</p>
          <ul>
            <li>Use <code>localhost:5173</code> instead of IP address</li>
            <li>Or enable HTTPS for your development server</li>
            <li>Make sure you're using a modern browser</li>
            <li>Allow camera and microphone permissions</li>
          </ul>
          <button 
            onClick={testMediaDevices} 
            style={{ 
              padding: '10px', 
              margin: '10px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Test Media Devices
          </button>
        </div>
      ) : (
        <>
          <h4>{remoteSocketId ? "Connected" : "No one in room"}</h4>
          {myStream && <button onClick={sendStreams}>Send Stream</button>}
          {remoteSocketId && <button onClick={handleCallUser}>CALL</button>}
          {myStream && (
            <>
              <h1>My Stream</h1>
              <ReactPlayer
                playing
                muted
                height="100px"
                width="200px"
                url={myStream}
              />
            </>
          )}
          {remoteStream && (
            <>
              <h1>Remote Stream</h1>
              <ReactPlayer
                playing
                muted
                height="100px"
                width="200px"
                url={remoteStream}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default RoomPage;