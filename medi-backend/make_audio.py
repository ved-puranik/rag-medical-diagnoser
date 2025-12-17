from gtts import gTTS
import os

# The script will say this out loud into an MP3 file
text = "Hello, my name is John Smith. My phone number is 555-0199. I have a severe pain in my left knee and I need a prescription for ibuprofen."

print("Generating audio file...")
tts = gTTS(text, lang='en')
tts.save("test_audio.mp3")

if os.path.exists("test_audio.mp3"):
    print("✅ Success! 'test_audio.mp3' has been created.")
else:
    print("❌ Error: File was not created.")