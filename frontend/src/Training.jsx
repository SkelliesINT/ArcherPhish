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
            <h3>PhishMe Simulation (Demo)</h3>
            <p>
              Explore how phishing simulations work in real-world environments.
            </p>
            <a
              href="https://www.cofense.com/phishing-simulation/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Explore <FaExternalLinkAlt />
            </a>
          </div>

          <div className="training-card">
            <h3>Cybersecurity Lab (Immersive Labs)</h3>
            <p>
              Hands-on labs to practice identifying and mitigating phishing attacks.
            </p>
            <a
              href="https://www.immersivelabs.com/resources/blog/phishing-training/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Try It <FaExternalLinkAlt />
            </a>
          </div>

          <div className="training-card">
            <h3>Proofpoint Security Awareness</h3>
            <p>
              Learn through simulated phishing attacks and training modules.
            </p>
            <a
              href="https://www.proofpoint.com/us/products/security-awareness-training"
              target="_blank"
              rel="noopener noreferrer"
            >
              View Demo <FaExternalLinkAlt />
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}