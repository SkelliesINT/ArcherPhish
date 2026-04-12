import React from "react";
import { FaShieldAlt, FaGamepad, FaExternalLinkAlt } from "react-icons/fa";
import "./Training.css";
import Sidebar from "./Sidebar";

export default function Training() {
  return (
    <div className="training-container">
      <Sidebar />

      <div className="training-main">
        <h1>Phishing Awareness Training</h1>
        <p className="training-intro">
          Learn how to recognize and prevent phishing attacks. These interactive
          resources will help you sharpen your cybersecurity skills.
        </p>

        {/* Educational Resources */}
        <section className="training-section">
          <h2>
            <FaShieldAlt className="training-icon" /> Educational Resources
          </h2>

          <div className="training-card">
            <h3>Google Phishing Quiz</h3>
            <p>
              Test your ability to identify phishing emails in this interactive
              quiz from Google.
            </p>
            <a
              href="https://phishingquiz.withgoogle.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Start Quiz <FaExternalLinkAlt />
            </a>
          </div>

          <div className="training-card">
            <h3>FTC – How to Recognize Phishing</h3>
            <p>
              Learn common phishing tactics and how attackers try to trick you.
            </p>
            <a
              href="https://consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams"
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit Site <FaExternalLinkAlt />
            </a>
          </div>

          <div className="training-card">
            <h3>CISA Phishing Guidance</h3>
            <p>
              Official cybersecurity awareness tips from the U.S. government.
            </p>
            <a
              href="https://www.cisa.gov/news-events/news/avoiding-social-engineering-and-phishing-attacks"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn More <FaExternalLinkAlt />
            </a>
          </div>
        </section>

        {/* Interactive Games */}
        <section className="training-section">
          <h2>
            <FaGamepad className="training-icon" /> Interactive Games
          </h2>

          <div className="training-card">
            <h3>CanIPhish Cyber Security Games</h3>
            <p>
              Interactive phishing and social engineering scenarios where you play as
              attacker or defender to test real-world decision making.
            </p>
            <a
              href="https://caniphish.com/free-cyber-security-games"
              target="_blank"
              rel="noopener noreferrer"
            >
              Play Game <FaExternalLinkAlt />
            </a>
          </div>

          <div className="training-card">
            <h3>CyberGLA Phishing Simulations</h3>
            <p>
              Game-based cybersecurity simulations that train you to detect spoofed
              emails and phishing indicators through short interactive exercises.
            </p>
            <a
              href="https://www.cybergla.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Launch Simulation <FaExternalLinkAlt />
            </a>
          </div>

          <div className="training-card">
            <h3>Cyber Crime Game (Interactive Awareness)</h3>
            <p>
              An immersive cyber awareness experience that uses storytelling and
              real-world attack scenarios to teach phishing and cyber threat detection.
            </p>
            <a
              href="https://cybercrimegame.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Start Experience <FaExternalLinkAlt />
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}