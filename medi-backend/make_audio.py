from gtts import gTTS
import os

# The script will say this out loud into an MP3 file
text = "Hi, this is Sarah Connor calling from Los Angeles. I started feeling chest palpitations last Tuesday. My date of birth is August 12th, 1985."
print("Generating audio file...")
tts = gTTS(text, lang='en')
tts.save("test_audio.mp3")

if os.path.exists("test_audio.mp3"):
    print("✅ Success! 'test_audio.mp3' has been created.")
else:
    print("❌ Error: File was not created.")