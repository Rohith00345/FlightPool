"use client";

import { useState } from "react";
import { Star, CheckCircle, X } from "lucide-react";

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  userId: string;
  driverName?: string;
  onRatingSubmitted?: () => void;
}

export default function RatingModal({
  isOpen,
  onClose,
  tripId,
  userId,
  driverName,
  onRatingSubmitted,
}: RatingModalProps) {
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(["Safe Driving", "Clean Cab"]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const availableTags = [
    "Safe Driving",
    "Polite Driver",
    "Clean Cab",
    "Smooth Pool",
    "Great Co-Riders",
    "Fast Route",
  ];

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await fetch(`/api/trips/${tripId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raterUserId: userId,
          score,
          tags: selectedTags,
          comment,
        }),
      });
      setSubmitted(true);
      setTimeout(() => {
        onRatingSubmitted?.();
        onClose();
      }, 1500);
    } catch (e) {
      console.error(e);
      setSubmitted(true);
      setTimeout(() => onClose(), 1000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="text-center py-6">
            <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900">Thank You!</h3>
            <p className="text-xs text-slate-500 mt-1">
              Your feedback keeps Mumbai airport carpooling safe and reliable.
            </p>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-bold text-slate-900 text-center">
              How was your trip?
            </h3>
            <p className="text-xs text-slate-500 text-center mb-5">
              Rating for {driverName || "Driver"} & Co-riders
            </p>

            {/* Stars */}
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setScore(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= score
                        ? "text-amber-400 fill-amber-400"
                        : "text-slate-200"
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-4 justify-center">
              {availableTags.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      active
                        ? "bg-teal-50 border-teal-600 text-teal-800 font-semibold"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* Comment */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add feedback or suggestions (optional)..."
              rows={2}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 mb-5 resize-none"
            />

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold py-3.5 rounded-2xl text-sm shadow-md transition-all disabled:opacity-60"
            >
              {loading ? "Submitting..." : "Submit Rating"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
