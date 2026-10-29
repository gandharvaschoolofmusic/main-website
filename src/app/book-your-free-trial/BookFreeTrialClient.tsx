"use client";
import { countryOptions } from "@/Data/CountryCode";
import { FormShell } from "@/components/auth/FormShell";
import { BookingSummary } from "@/components/auth/BookingSummary";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Select, { ActionMeta, SingleValue } from "react-select";
import { useRouter } from "next/navigation";

export default function BookYourFreeTrialClient() {
  const data = {
    instruments: [
      "Piano",
      "Electronic keyboard",
      "Acoustic Guitar",
      "Electric Guitar",
      "Ukulele",
      "Violin",
      "Flute",
      "Tabla",
    ],
    singing: [
      "Western Vocals",
      "Carnatic Vocals",
      "Hindustani Vocals",
      "Bollywood Vocals",
      "Kannada Music",
      "Malayalam Music",
      "Tamil Music",
      "Telugu Music",
    ],
    dancing: ["Bharatanatyam", "Kathak", "Bollywood Dance"],
  };
  const initialFormState = {
    phone: "",
    name: "",
    gender: "",
    category: "",
    referralCode: "",
    medium: "",
    prefDate: "",
    prefTime: "",
    age: "",
    email: "",
    countryCode: "",
    tnc: true,
  };

  const [refCode, setRefCode] = useState("");
  const [step, setStep] = useState(1);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [tnc, setTnc] = useState(false);
  const [warning, setWarning] = useState({
    phone: false,
    name: false,
    gender: false,
    prefDate: false,
    prefTime: false,
    age: false,
    email: false,
    tnc: false,
    countryCode: false,
    category: false,
  });

  const categoryOptions = Object.entries(data).map(
    ([category, subcategories]) => ({
      label: category.charAt(0).toUpperCase() + category.slice(1),
      options: subcategories.map((subcategory) => ({
        value: subcategory,
        label: subcategory.charAt(0).toUpperCase() + subcategory.slice(1),
      })),
    })
  );
  const router = useRouter();

  const chnageStep = (newStep: number) => {
    setStep(newStep);
  };

  const toggleTnC = () => {
    setTnc((prev) => !prev);
    setFormData((prev) => {
      prev.tnc = !prev.tnc;
      return prev;
    });
  };

  const validateReferral = useCallback((code: string) => {
    const validCodes = ["ABD345", "MUSIC10", "TRIAL50"];
    const isValidCode = validCodes.includes(code.toUpperCase());
    setShowValidation(true);
    setIsValid(isValidCode);
    setIsReadOnly(isValidCode);
    setRefCode(isValidCode ? code : "");
    setFormData(previous => ({ ...previous, referralCode: isValidCode ? code : "" }));
  }, [setShowValidation, setIsValid, setIsReadOnly, setRefCode, setFormData]);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) {
      // Read browser-only referral data after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      validateReferral(ref);
    }
  }, [validateReferral]);

  type CountryOption = { value: string; label: string };

  const handleCountryChange = (selectedOption: CountryOption | null) => {
    // console.log("Selected Country Code:", selectedOption);
    if (selectedOption) {
      setFormData({
        ...formData,
        countryCode: selectedOption.value,
      });
    } else {
      //  console.log("No country code selected");
    }
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  type Option = { value: string; label: string };

  const handleCategoryChange = (
    newValue: SingleValue<Option>,
    _actionMeta: ActionMeta<Option> // Unused but kept
  ) => {
    void _actionMeta;
    if (newValue) {
      // console.log("Selected Category:", newValue.value);
      setSelectedCategory(newValue.value);
      setFormData({
        ...formData,
        category: newValue.value,
      });
    } else {
      //   console.log("No category selected");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent the default form submission behavior
    setSubmitting(true); // Set submitting to true
    const localWarning = {
      phone: false,
      name: false,
      gender: false,
      prefDate: false,
      prefTime: false,
      age: false,
      email: false,
      tnc: false,
      countryCode: false,
      category: false,
    };
    let hasAwarning = false;
    if (formData.phone === initialFormState.phone) {
      hasAwarning = true;
      localWarning.phone = true;
    }
    if (formData.name === initialFormState.name) {
      hasAwarning = true;
      localWarning.name = true;
    }
    if (formData.gender === initialFormState.gender) {
      hasAwarning = true;
      localWarning.gender = true;
    }
    if (formData.prefDate === initialFormState.prefDate) {
      hasAwarning = true;
      localWarning.prefDate = true;
    }
    if (formData.prefTime === initialFormState.prefTime) {
      hasAwarning = true;
      localWarning.prefTime = true;
    }
    if (formData.age === initialFormState.age) {
      hasAwarning = true;
      localWarning.age = true;
    }
    if (formData.email === initialFormState.email) {
      hasAwarning = true;
      localWarning.email = true;
    }
    if (formData.countryCode === initialFormState.countryCode) {
      hasAwarning = true;
      localWarning.countryCode = true;
    }
    if (formData.category === initialFormState.category) {
      hasAwarning = true;
      localWarning.category = true;
    }
    if (!tnc) {
      hasAwarning = true;
      localWarning.tnc = true;
    }

    if (hasAwarning) {
      setWarning((prev) => ({ ...prev, ...localWarning }));
      setSubmitting(false); // Reset submitting to false
      if (
        localWarning.phone ||
        localWarning.countryCode ||
        localWarning.name ||
        localWarning.gender ||
        localWarning.category
      ) {
        setStep(1);
      } else if (localWarning.prefDate || localWarning.prefTime) {
        setStep(2);
      }
      return;
    }

    //   console.log("Form Data Submitted:", formData);

    setWarning({
      phone: false,
      name: false,
      gender: false,
      prefDate: false,
      prefTime: false,
      age: false,
      email: false,
      tnc: false,
      countryCode: false,
      category: false,
    });
    
    // Prepare the data for submission
    const ipResponse = await fetch("https://api.ipify.org?format=json");
    const ipData = await ipResponse.json();
    const userIP = ipData.ip;
    // console.log("User IP Address:", userIP);
    const locationResponse = await fetch(`https://ipapi.co/${userIP}/json/`);
    const locationData = await locationResponse.json();

    //console.log(locationData);
    const data = {
      ...formData,
      activeSheet: "Free__Trial",
      phone: `${formData.countryCode}-${formData.phone}`,
      name: formData.name,
      gender: formData.gender,
      category: formData.category,
      referralCode: formData.referralCode,
      medium: formData.medium,
      prefTime: formData.prefTime,
      prefDate: formData.prefDate,
      age: formData.age,
      email: formData.email,
      userIP: userIP,
      location: `${locationData.city}, ${locationData.region}, ${locationData.country_name}`,
    };

    try {
      // Sending data to Google Apps Script endpoint
      const response = await fetch(
        "https://script.google.com/macros/s/AKfycbySJzE7ICyLe7PubP04AOdVRKpCt9DeqV6v3xeelfjvMRf95KIwIqBsUCvTw1_4yeWyCw/exec",
        {
          method: "POST",
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
          body: JSON.stringify(data),
        }
      );

      // Parsing the response
      //const result = await response.json();
      // console.log(result);

      // If submission is successful, reset the form
      if (response.ok) {
        //   console.log("Form submitted successfully!");

        // Reset the form data
        setFormData(initialFormState);

        // Reset the category and any other states if needed
        setSelectedCategory(""); // Reset the selected category
        setRefCode(""); // Optionally reset referral code
        setIsValid(false); // Reset referral code validation status
        setShowValidation(false); // Reset validation message
        router.push("/thank-you");
        // setStep(1);
      } else {
        console.error("Failed to submit the form.");
      }
    } catch (error) {
      console.error("Error during form submission:", error);
    }
    setSubmitting(false); // Reset submitting to false
  };

  return (
    <FormShell variant="student" sidebar={
      <BookingSummary
        discipline={formData.category || "Choose your discipline"}
        date={formData.prefDate ? new Date(`${formData.prefDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) : undefined}
        time={formData.prefTime || undefined}
        onEditDiscipline={step > 1 ? () => chnageStep(1) : undefined}
        onEditSchedule={step === 3 ? () => chnageStep(2) : undefined}
      />
    }>
      <div className="entry-legacy-trial">
        <nav className="entry-legacy-progress" aria-label="Trial booking progress">{["Student details", "Date & time", "Contact details"].map((label,index) => <span key={label} aria-current={step === index + 1 ? "step" : undefined}><b>{index + 1}</b>{label}</span>)}</nav>
        <form
          className="w-full"
          onSubmit={handleSubmit}
        >
          {/* STEP - 1  */}
          <div
            hidden={step !== 1} className="entry-legacy-step"
          >
            <h1
              className="text-[30px]  md:text-[36px] text-center  text-[#210638] mb-4"
              style={{ fontWeight: 500 }}
            >
              Let&apos;s Book Your FREE Trial
            </h1>
            <p className="text-center text-gray-600 mb-8">
              Let us know who is attending the trial
            </p>

            {/* Phone Number */}
            <div className="mb-6">
              <label htmlFor="phone" className="block text-gray-700 font-medium mb-2 sm:text-left">
                Phone Number*{" "}
                <span className="text-sm text-gray-500">
                  (with country code)
                </span>
              </label>
              <div className="flex flex-row items-center border border-gray-300 rounded-md focus-within:ring-orange-500 focus-within:ring-2 transition-all duration-300">
                <div className="relative w-auto">
                  <Select
                    id="countryCode"
                    aria-label="Country code" classNamePrefix="entry-select"
                    name="countryCode"
                    options={countryOptions}
                    onChange={handleCountryChange}
                    placeholder="Select"
                    styles={{
                      control: (base) => ({
                        ...base,
                        border: "none",
                        boxShadow: "none",
                        padding: "0",
                        minWidth: "120px",
                        cursor: "pointer",
                      }),
                      valueContainer: (base) => ({
                        ...base,
                        padding: "0",
                        justifyContent: "center",
                      }),
                      dropdownIndicator: (base, state) => ({
                        ...base,
                        transform: state.selectProps.menuIsOpen
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }),
                      menu: (base) => ({
                        ...base,
                        zIndex: 10,
                        width: "auto",
                      }),
                    }}
                    components={{
                      IndicatorSeparator: () => null,
                    }}
                    getOptionLabel={(e) => `${e.label}`}
                  />
                </div>
                <input
                  type="tel"
                  inputMode="tel" autoComplete="tel-national"
                  id="phone"
                  name="phone"
                  onChange={handleChange}
                  value={formData.phone}
                  placeholder="Enter your Number"
                  className="flex-1 p-2 focus:outline-none"
                />
              </div>
              {warning.phone && <WarningMsg message="This field is required" />}
              {warning.countryCode && (
                <WarningMsg message="Country code is required" />
              )}
            </div>

            {/* Student Name */}
            <div className="mb-6">
              <label htmlFor="name" className="block text-gray-700 font-medium mb-2 sm:text-left">
                Student Name*
              </label>
              <input
                type="text"
                id="name"
                name="name"
                onChange={handleChange}
                value={formData.name}
                placeholder="Enter full name of student"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-500"
              />
              {warning.name && <WarningMsg message="This field is required" />}
            </div>

            {/* Select Gender */}
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2 sm:text-left">
                Select Gender*
              </label>
              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    id="male"
                    name="gender"
                    value="Male"
                    checked={formData.gender === "Male"}
                    onChange={handleChange}
                    className="mr-2 focus:ring-orange-500"
                  />
                  Male
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    id="female"
                    name="gender"
                    value="Female"
                    checked={formData.gender === "Female"}
                    onChange={handleChange}
                    className="mr-2 focus:ring-orange-500"
                  />
                  Female
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    id="other"
                    name="gender"
                    value="Other"
                    checked={formData.gender === "Other"}
                    onChange={handleChange}
                    className="mr-2 focus:ring-orange-500"
                  />
                  I don&apos;t want to tell
                </label>
              </div>
              {warning.gender && (
                <WarningMsg message="This field is required" />
              )}
            </div>

            {/* Choose Your Category */}
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2 sm:text-left">
                Choose Your Category*
              </label>
              <Select
                options={categoryOptions}
                aria-label="Choose your category" classNamePrefix="entry-select"
                onChange={handleCategoryChange}
                placeholder="Select a category"
                styles={{
                  control: (base) => ({
                    ...base,
                    borderColor: "gray",
                    boxShadow: "none",
                    "&:hover": { borderColor: "orange" },
                  }),
                  menu: (base) => ({
                    ...base,
                    zIndex: 10,
                  }),
                }}
              />
              {warning.category && (
                <WarningMsg message="This field is required" />
              )}
            </div>

            {/* Referral Code */}
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2 sm:text-left">
                Referral Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="referralCode"
                  name="referralCode"
                  value={refCode}
                  readOnly={isReadOnly}
                  onChange={(e) => {
                    setRefCode(e.target.value);
                    setIsValid(false);
                    setIsReadOnly(false);
                    setShowValidation(false);
                  }}
                  placeholder="Enter referral code if you have"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-500"
                />
                <button
                  type="button"
                  aria-label="Check Referral Code"
                  onClick={() => validateReferral(refCode)}
                  className="bg-orange-500 text-white px-3 py-2 rounded"
                >
                  Check
                </button>
              </div>
              {showValidation && isValid && (
                <p className="text-green-600 text-[14px] mt-2">
                  ✅ Valid Code! You get 10% off 🎉
                </p>
              )}
              {showValidation && !isValid && (
                <p className="text-red-600 text-[14px] mt-2">
                  ❌ Invalid code. Please try another.
                </p>
              )}
            </div>

            {/* How Did You Hear About Us */}
            <div className="mb-8">
              <label className="block text-gray-700 font-medium mb-2 sm:text-left">
                How Did You Hear About Us?
              </label>
              <select
                name="medium"
                onChange={handleChange}
                value={formData.medium}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-500"
              >
                <option>Please select one</option>
                <option value={"Facebook"}>Facebook</option>
                <option value={"Instagram"}>Instagram</option>
                <option value={"Google Search"}>Google Search</option>
                <option value={"Email"}>From Email</option>
                <option value={"Friends"}>Friends</option>
              </select>
            </div>

            <div className="flex w-full justify-between flex-wrap gap-2">
              {/* Next Button */}
              <div
                className={`flex w-full justify-end sm:text-right text-center ml-auto`}
              >
                <button
                  type="button"
                  aria-label="Next"
                  onClick={() => {
                    chnageStep(step + 1);
                  }}
                  className="w-full md:w-fit bg-orange-500 text-white font-medium px-10 py-2 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* STEP - 2  */}
          <div
            hidden={step !== 2} className="entry-legacy-step"
          >
            <h2
              className="text-[30px]  md:text-[36px] text-center  text-[#210638] mb-4"
              style={{ fontWeight: 500 }}
            >
              What would be an ideal time?
            </h2>
            <p className="text-center text-gray-600 mb-8">
              Choose a date and time that suits you best.
            </p>
            {/* date  */}
            <div className="mb-6">
              <label htmlFor="prefDate" className="block text-gray-700 font-medium mb-2 sm:text-left">
                Choose a Date*
              </label>
              <input
                type="date"
                id="prefDate"
                name="prefDate"
                onChange={handleChange}
                value={formData.prefDate}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-500"
              />
              {warning.prefDate && (
                <WarningMsg message="This field is required" />
              )}
            </div>
            {/* time  */}
            <div className="mb-6">
              <label htmlFor="prefTime" className="block text-gray-700 font-medium mb-2 sm:text-left">
                Choose a Time*
              </label>
              <input
                type="time"
                id="prefTime"
                onChange={handleChange}
                value={formData.prefTime}
                name="prefTime"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-500"
              />
              {warning.prefTime && (
                <WarningMsg message="This field is required" />
              )}
            </div>

            <div className="flex md:flex-row flex-col w-full justify-between flex-wrap gap-4">
              {/* Previous Button */}
              <div className="sm:text-left text-center">
                <button
                  type="button"
                  aria-label="Previous"
                  onClick={() => chnageStep(step - 1)}
                  className="w-full sm:w-fit bg-gray-300 text-gray-800 font-medium px-10 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                >
                  Previous
                </button>
              </div>

              {/* Next Button */}
              <div className={`sm:text-right text-center`}>
                <button
                  type="button"
                  aria-label="Next"
                  onClick={() => {
                    chnageStep(step + 1);
                  }}
                  className="w-full sm:w-fit bg-orange-500 text-white font-medium px-10 py-2 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* STEP - 3  */}
          <div
            hidden={step !== 3} className="entry-legacy-step"
          >
            <h2
              className="text-[30px]  md:text-[36px] text-center  text-[#210638] mb-4"
              style={{ fontWeight: 500 }}
            >
              Contact Details
            </h2>
            <p className="text-center text-gray-600 mb-8">Enter your details</p>

            {/* Age group */}
            <div className="mb-8">
              <label className="block text-gray-700 font-medium mb-2 sm:text-left">
                Student Age Group*
              </label>
              <select
                name="age" aria-label="Student age group"
                onChange={handleChange}
                value={formData.age}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-500"
              >
                <option>Please select one</option>
                <option value={"6-9"}>6-9 years</option>
                <option value={"10-12"}>10-12 years</option>
                <option value={"13-17"}>13-17 years</option>
                <option value={"18-30"}>18-30 years</option>
                <option value={"31-40"}>31-40 years</option>
                <option value={"41-50"}>41-50 years</option>
                <option value={"50+"}>50+ years</option>
              </select>
              {warning.age && <WarningMsg message="This field is required" />}
            </div>

            {/* email */}
            <div className="mb-6">
              <label htmlFor="email" className="block text-gray-700 font-medium mb-2 sm:text-left">
                Email*
              </label>
              <input
                type="email"
                id="email"
                name="email"
                onChange={handleChange}
                value={formData.email}
                placeholder="Enter your email"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-500"
              />
              {warning.email && <WarningMsg message="This field is required" />}
            </div>

            {/* terms n conditions  */}
            <div className="flex flex-col mb-6 cursor-pointer">
              <div className="flex gap-4">
                <input
                  type="checkbox"
                  name="terms"
                  id="terms"
                  onChange={toggleTnC}
                />
                <label htmlFor="terms" className=" text-gray-700 font-medium">
                  I&apos;ve read the{" "}
                  <Link
                    href="/policy/terms-conditions/"
                    aria-label="Terms & Conditions"
                    className="text-blue-600 underline"
                  >
                    Terms & Conditions
                  </Link>
                </label>
              </div>
              {warning.tnc && <WarningMsg message="This field is required" />}
            </div>

            <div className="flex flex-col md:flex-row w-full justify-between flex-wrap gap-4">
              {/* Previous Button */}
              <div className="sm:text-left text-center">
                <button
                  type="button"
                  aria-label="Previous"
                  onClick={() => chnageStep(step - 1)}
                  className="w-full sm:w-fit bg-gray-300 text-gray-800 font-medium px-10 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                >
                  Previous
                </button>
              </div>

              {/* Submit Button */}
              <div className={`sm:text-right text-center`}>
                <button
                  type="submit"
                  aria-label="Submit"
                  disabled={submitting}
                  className="w-full sm:w-fit bg-orange-500 text-white font-medium px-10 py-2 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
      <p className="entry-form-footer">24/7 Dedicated Customer Support</p>
    </FormShell>
  );
}

function WarningMsg({ message }: { message: string }) {
  return (
    <div className="w-full text-red-900 text-xs rounded-lg bg-red-100 p-3 mt-2">
      {message}
    </div>
  );
}

// "use client";
// import { countryOptions } from "@/Data/CountryCode";
// import { FormShell } from "@/components/auth/FormShell";
// import Link from "next/link";
// import { useEffect, useState, useRef } from "react";
// import Select, { ActionMeta, SingleValue } from "react-select";
// import { useRouter } from "next/navigation";
// import { auth } from "./setup";
// import {
//   RecaptchaVerifier,
//   signInWithPhoneNumber,
//   ConfirmationResult,
//   UserCredential,
// } from "firebase/auth";
// import { get } from "http";

// export default function BookYourFreeTrialClient() {
//   const data = {
//     instruments: [
//       "Piano",
//       "Electronic keyboard",
//       "Acoustic Guitar",
//       "Electric Guitar",
//       "Ukulele",
//       "Violin",
//       "Flute",
//       "Tabla",
//     ],
//     singing: [
//       "Western Vocals",
//       "Carnatic Vocals",
//       "Hindustani Vocals",
//       "Bollywood Vocals",
//       "Kannada Music",
//       "Malayalam Music",
//       "Tamil Music",
//       "Telugu Music",
//     ],
//     dancing: ["Bharatanatyam", "Kathak", "Bollywood Dance"],
//   };
//   const initialFormState = {
//     phone: "",
//     name: "",
//     gender: "",
//     category: "",
//     referralCode: "",
//     medium: "",
//     prefDate: "",
//     prefTime: "",
//     age: "",
//     email: "",
//     countryCode: "",
//     tnc: true,
//   };

//   const [refCode, setRefCode] = useState("");
//   const [step, setStep] = useState(1);
//   const [isReadOnly, setIsReadOnly] = useState(false);
//   const [isValid, setIsValid] = useState(false);
//   const [showValidation, setShowValidation] = useState(false);
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
//   const [formData, setFormData] = useState(initialFormState);
//   const [submitting, setSubmitting] = useState(false);
//   const [tnc, setTnc] = useState(false);
//   const [warning, setWarning] = useState({
//     phone: false,
//     name: false,
//     gender: false,
//     prefDate: false,
//     prefTime: false,
//     age: false,
//     email: false,
//     tnc: false,
//     countryCode: false,
//     category: false,
//   });

//   const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
//   const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
//   const [confirmationResult, setConfirmationResult] =
//     useState<ConfirmationResult | null>(null);
//   const [otpData, setOtpData] = useState({
//     captchaDone: false,
//     wrongOtp: false,
//     otpResent: false,
//   });
//   const [loading, setLoading] = useState(false);
//   const [timer, setTimer] = useState<number>(30);
//   const [canResend, setCanResend] = useState<boolean>(false);

//   useEffect(() => {
//     if (step === 1.5) {
//       setCanResend(false);
//       setTimer(30);
//       const interval = setInterval(() => {
//         setTimer((prev) => {
//           if (prev <= 1) {
//             clearInterval(interval);
//             setCanResend(true);
//             return 0;
//           }
//           return prev - 1;
//         });
//       }, 1000);
//       return () => clearInterval(interval);
//     }
//   }, [step, otpData.otpResent]);

//   const handleOtpChange = (
//     e: React.ChangeEvent<HTMLInputElement>,
//     idx: number
//   ) => {
//     const newVal = e.target.value;

//     // if wrongOtp was true, clear it immediately
//     if (otpData.wrongOtp) {
//       setOtpData((d) => ({ ...d, wrongOtp: false }));
//     }

//     // Allow empty string (backspace) OR a single digit 0–9
//     if (newVal === "" || /^[0-9]$/.test(newVal)) {
//       const updated = [...otp];
//       updated[idx] = newVal;
//       setOtp(updated);

//       if (newVal !== "" && idx < inputsRef.current.length - 1) {
//         inputsRef.current[idx + 1]?.focus();
//       }
//     }
//   };

//   const handleKeyDown = (
//     e: React.KeyboardEvent<HTMLInputElement>,
//     idx: number
//   ) => {
//     if (e.key === "Backspace") {
//       // If current box has a digit, let handleChange("") clear it.
//       if (otp[idx] !== "") {
//         return;
//       }

//       // If current box is already empty AND there's a previous box:
//       if (idx > 0) {
//         e.preventDefault(); // prevent default “cursor jump” behavior
//         const updated = [...otp];
//         updated[idx - 1] = ""; // clear previous box
//         setOtp(updated);
//         inputsRef.current[idx - 1]?.focus(); // move focus back
//       }
//     }
//   };

//   const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
//     e.preventDefault();
//     const paste = e.clipboardData
//       .getData("Text")
//       .trim()
//       .split("")
//       .filter((ch) => /^[0-9]$/.test(ch));

//     if (paste.length === 0) return;
//     // Clear wrongOtp too
//     if (otpData.wrongOtp) {
//       setOtpData((d) => ({ ...d, wrongOtp: false }));
//     }

//     const updated = otp.map((_, i) => paste[i] || "");
//     setOtp(updated);

//     // focus at the next empty box (or last one)
//     const nextIdx = paste.length >= otp.length ? otp.length - 1 : paste.length;
//     inputsRef.current[nextIdx]?.focus();
//   };

//   const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

//   function initRecaptcha() {
//     // If there’s already a verifier, clear it first
//     if (recaptchaVerifier) {
//       recaptchaVerifier.current?.clear();
//     }

//     // Create and render a new invisible ReCAPTCHA
//     recaptchaVerifier.current = new RecaptchaVerifier(
//       auth,
//       "sign-in-button", // This must match an element ID in your JSX, or you can use a dummy <div id="sign-in-button" /> hidden in your UI
//       {
//         size: "invisible", // Invisible reCAPTCHA
//         callback: () => {
//           console.log("reCAPTCHA solved—will proceed with verify.");
//         },
//       }
//     );
//     setOtpData({
//       ...otpData,
//       captchaDone: true,
//     });
//   }

//   function getPhoneNo() {
//     let cc = formData.countryCode.trim();
//     if (!cc.startsWith("+")) {
//       cc = "+" + cc;
//     }
//     // 2) Strip any leading zeros from phone (not needed in E.164)
//     const subscriber = formData.phone.trim().replace(/^0+/, "");
//     // 3) Concatenate
//     return cc + subscriber;
//   }

//   const sendOtp = (): void => {
//     setOtpData((prev) => ({
//       ...prev,
//       otpResent: !prev.otpResent,
//     }));
//     setLoading(true);
//     if (
//       formData.phone === "" ||
//       formData.countryCode === "" ||
//       formData.name === "" ||
//       formData.gender === "" ||
//       formData.category === ""
//     ) {
//       alert("Please fill all the fields before verifying!");
//       return;
//     }

//     // initialize the ReCAPTCHA each time before sending
//     if (otpData.captchaDone === false) initRecaptcha();
//     //const appVerifier = recaptchaVerifier!;
//     const phoneNo = getPhoneNo();

//     // 2. Actually send the SMS OTP
//     signInWithPhoneNumber(auth, phoneNo, recaptchaVerifier.current!)
//       .then((result: ConfirmationResult) => {
//         // Store ConfirmationResult object for later verification
//         setConfirmationResult(result);
//         console.log("OTP sent successfully to:", phoneNo);
//         setStep(1.5); // Proceed to OTP entry step
//       })
//       .catch((error: Error) => {
//         console.error("Error sending OTP:", error);
//         // Optionally reset/re-render reCAPTCHA:
//         recaptchaVerifier.current?.clear();
//       })
//       .finally(() => {
//         setLoading(false);
//       });
//   };

//   /**
//    * verifyOtp(): Uses the stored confirmationResult to confirm the code (`otp`).
//    */
//   const verifyOtp = async (): Promise<void> => {
//     if (!confirmationResult) {
//       console.error("No confirmation result available—call sendOtp() first.");
//       setStep(1);
//       return;
//     }

//     const code = otp.join("");
//     try {
//       const userCredential: UserCredential = await confirmationResult.confirm(
//         code
//       );
//       setStep(2); // Move to next step after successful verification
//     } catch (error: any) {
//       console.log(
//         "User couldn't sign in (bad verification code?):",
//         error.message
//       );
//       // recaptchaVerifier?.clear(); // Clear the reCAPTCHA
//       // alert("Invalid OTP. Please try again.");
//       setOtpData({
//         ...otpData,
//         wrongOtp: true,
//       });
//     }
//   };

//   const categoryOptions = Object.entries(data).map(
//     ([category, subcategories]) => ({
//       label: category.charAt(0).toUpperCase() + category.slice(1),
//       options: subcategories.map((subcategory) => ({
//         value: subcategory,
//         label: subcategory.charAt(0).toUpperCase() + subcategory.slice(1),
//       })),
//     })
//   );
//   const router = useRouter();

//   useEffect(() => {
//     const params = new URLSearchParams(window.location.search);
//     const ref = params.get("ref");

//     if (ref) {
//       setRefCode(ref);
//       setIsReadOnly(true);
//       validateReferral(ref);
//     }
//   }, []);

//   const chnageStep = (newStep: number) => {
//     setStep(newStep);
//   };

//   const toggleTnC = () => {
//     setTnc((prev) => !prev);
//     setFormData((prev) => {
//       prev.tnc = !prev.tnc;
//       return prev;
//     });
//   };

//   const validateReferral = async (code: string) => {
//     const validCodes = ["ABD345", "MUSIC10", "TRIAL50"];
//     const isValidCode = validCodes.includes(code.toUpperCase());

//     setShowValidation(true);
//     setIsValid(isValidCode);
//     setIsReadOnly(isValidCode);
//     if (isValidCode) {
//       setRefCode(code);
//       setFormData({
//         ...formData,
//         referralCode: code,
//       });
//     } else {
//       setRefCode("");
//       setFormData({
//         ...formData,
//         referralCode: "",
//       });
//     }
//   };

//   type CountryOption = { value: string; label: string };

//   const handleCountryChange = (selectedOption: CountryOption | null) => {
//     // console.log("Selected Country Code:", selectedOption);
//     if (selectedOption) {
//       setFormData({
//         ...formData,
//         countryCode: selectedOption.value,
//       });
//     } else {
//       //  console.log("No country code selected");
//     }
//   };

//   const handleChange = (
//     event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
//   ) => {
//     const { name, value } = event.target;
//     setFormData({
//       ...formData,
//       [name]: value,
//     });
//   };

//   type Option = { value: string; label: string };

//   const handleCategoryChange = (
//     newValue: SingleValue<Option>,
//     _actionMeta: ActionMeta<Option> // Unused but kept
//   ) => {
//     // eslint-disable-next-line @typescript-eslint/no-unused-vars
//     void _actionMeta;
//     if (newValue) {
//       // console.log("Selected Category:", newValue.value);
//       setSelectedCategory(newValue.value);
//       setFormData({
//         ...formData,
//         category: newValue.value,
//       });
//     } else {
//       //   console.log("No category selected");
//     }
//   };

//   const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
//     event.preventDefault(); // Prevent the default form submission behavior
//     setSubmitting(true); // Set submitting to true
//     const localWarning = {
//       phone: false,
//       name: false,
//       gender: false,
//       prefDate: false,
//       prefTime: false,
//       age: false,
//       email: false,
//       tnc: false,
//       countryCode: false,
//       category: false,
//     };
//     let hasAwarning = false;
//     if (formData.phone === initialFormState.phone) {
//       hasAwarning = true;
//       localWarning.phone = true;
//     }
//     if (formData.name === initialFormState.name) {
//       hasAwarning = true;
//       localWarning.name = true;
//     }
//     if (formData.gender === initialFormState.gender) {
//       hasAwarning = true;
//       localWarning.gender = true;
//     }
//     if (formData.prefDate === initialFormState.prefDate) {
//       hasAwarning = true;
//       localWarning.prefDate = true;
//     }
//     if (formData.prefTime === initialFormState.prefTime) {
//       hasAwarning = true;
//       localWarning.prefTime = true;
//     }
//     if (formData.age === initialFormState.age) {
//       hasAwarning = true;
//       localWarning.age = true;
//     }
//     if (formData.email === initialFormState.email) {
//       hasAwarning = true;
//       localWarning.email = true;
//     }
//     if (formData.countryCode === initialFormState.countryCode) {
//       hasAwarning = true;
//       localWarning.countryCode = true;
//     }
//     if (formData.category === initialFormState.category) {
//       hasAwarning = true;
//       localWarning.category = true;
//     }
//     if (!tnc) {
//       hasAwarning = true;
//       localWarning.tnc = true;
//     }

//     if (hasAwarning) {
//       setWarning((prev) => ({ ...prev, ...localWarning }));
//       setSubmitting(false); // Reset submitting to false
//       if (
//         localWarning.phone ||
//         localWarning.countryCode ||
//         localWarning.name ||
//         localWarning.gender ||
//         localWarning.category
//       ) {
//         setStep(1);
//       } else if (localWarning.prefDate || localWarning.prefTime) {
//         setStep(2);
//       }
//       return;
//     }

//     //   console.log("Form Data Submitted:", formData);

//     setWarning({
//       phone: false,
//       name: false,
//       gender: false,
//       prefDate: false,
//       prefTime: false,
//       age: false,
//       email: false,
//       tnc: false,
//       countryCode: false,
//       category: false,
//     });

//     // Prepare the data for submission
//     const ipResponse = await fetch("https://api.ipify.org?format=json");
//     const ipData = await ipResponse.json();
//     const userIP = ipData.ip;
//     // console.log("User IP Address:", userIP);
//     const locationResponse = await fetch(`https://ipapi.co/${userIP}/json/`);
//     const locationData = await locationResponse.json();

//     //console.log(locationData);
//     const data = {
//       ...formData,
//       activeSheet: "Free__Trial",
//       phone: `${formData.countryCode}-${formData.phone}`,
//       name: formData.name,
//       gender: formData.gender,
//       category: formData.category,
//       referralCode: formData.referralCode,
//       medium: formData.medium,
//       prefTime: formData.prefTime,
//       prefDate: formData.prefDate,
//       age: formData.age,
//       email: formData.email,
//       userIP: userIP,
//       location: `${locationData.city}, ${locationData.region}, ${locationData.country_name}`,
//     };

//     try {
//       // Sending data to Google Apps Script endpoint
//       const response = await fetch(
//         "https://script.google.com/macros/s/AKfycbzSmFtfPs4LT0MHo31uuOBaPa4llSzX0sm-BLI5w5bacCpjKECpM7AzWU6qVulbmNHn/exec",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "text/plain; charset=utf-8",
//           },
//           body: JSON.stringify(data),
//         }
//       );

//       // Parsing the response
//       //const result = await response.json();
//       // console.log(result);

//       // If submission is successful, reset the form
//       if (response.ok) {
//         //   console.log("Form submitted successfully!");

//         // Reset the form data
//         setFormData(initialFormState);

//         // Reset the category and any other states if needed
//         setSelectedCategory(""); // Reset the selected category
//         setRefCode(""); // Optionally reset referral code
//         setIsValid(false); // Reset referral code validation status
//         setShowValidation(false); // Reset validation message
//         router.push("/thank-you");
//         // setStep(1);
//       } else {
//         console.error("Failed to submit the form.");
//       }
//     } catch (error) {
//       console.error("Error during form submission:", error);
//     }
//     setSubmitting(false); // Reset submitting to false
//   };

//   return (
//     <div>
//       <section className="bg-[#3C096C] w-full h-[50vh] md:h-[35vh] bg-no-repeat bg-top bg-cover flex flex-col items-start justify-center py-10 px-4">
//         <div className="flex flex-col items-center justify-center w-full">
//           <div className="w-full flex items-center justify-center mb-4 mt-10">
//             <Image
//               src={"/cropped-Add-a-subheading-5-png-scaled.avif"}
//               alt="logo"
//               height={200}
//               width={200}
//             />
//           </div>
//           <div
//             className="text-white text-[16px] md:text-[16px] w-full flex flex-col md:flex-row items-center md:items-center gap-2 md:gap-0 md:justify-evenly  p-2"
//             style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}
//           >
//             <p>1. Student Details</p>
//             <p>2. Date & Time</p>
//             <p>3. Contact Details</p>
//           </div>
//         </div>
//       </section>

//       <div
//         className="flex justify-center  px-4 mt-10 "
//         style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 400 }}
//       >
//         <form
//           className="w-full"
//           onSubmit={handleSubmit}
//         >
//           {/* STEP - 1  */}
//           <div
//             className={`${
//               step === 1 ? "w-full h-fit" : "w-0 opacity-0 h-20 overflow-hidden"
//             } transition-all duration-300`}
//           >
//             <h1
//               className="text-[30px]  md:text-[36px] text-center  text-[#210638] mb-4"
//               style={{ fontWeight: 500 }}
//             >
//               Let&apos;s Book Your FREE Trial
//             </h1>
//             <p className="text-center text-gray-600 mb-8">
//               Let us know who is attending the trial
//             </p>

//             {/* Phone Number */}
//             <div className="mb-6">
//               <label className="block text-gray-700 font-medium mb-2 sm:text-left">
//                 Phone Number*{" "}
//                 <span className="text-sm text-gray-500">
//                   (OTP will be sent to this number for verification)
//                 </span>
//               </label>
//               <div className="flex flex-row items-center border border-gray-300 rounded-md focus-within:ring-orange-500 focus-within:ring-2 transition-all duration-300">
//                 <div className="relative w-auto">
//                   <Select
//                     id="countryCode"
//                     name="countryCode"
//                     options={countryOptions}
//                     onChange={handleCountryChange}
//                     placeholder="Select"
//                     styles={{
//                       control: (base) => ({
//                         ...base,
//                         border: "none",
//                         boxShadow: "none",
//                         padding: "0",
//                         minWidth: "120px",
//                         cursor: "pointer",
//                       }),
//                       valueContainer: (base) => ({
//                         ...base,
//                         padding: "0",
//                         justifyContent: "center",
//                       }),
//                       dropdownIndicator: (base, state) => ({
//                         ...base,
//                         transform: state.selectProps.menuIsOpen
//                           ? "rotate(180deg)"
//                           : "rotate(0deg)",
//                         transition: "transform 0.2s",
//                       }),
//                       menu: (base) => ({
//                         ...base,
//                         zIndex: 10,
//                         width: "auto",
//                       }),
//                     }}
//                     components={{
//                       IndicatorSeparator: () => null,
//                     }}
//                     getOptionLabel={(e) => `${e.label}`}
//                   />
//                 </div>
//                 <input
//                   type="number"
//                   id="phone"
//                   name="phone"
//                   onChange={handleChange}
//                   value={formData.phone}
//                   placeholder="Enter your Number"
//                   className="flex-1 p-2 focus:outline-none"
//                 />
//               </div>
//               {warning.phone && <WarningMsg message="This field is required" />}
//               {warning.countryCode && (
//                 <WarningMsg message="Country code is required" />
//               )}
//             </div>

//             {/* Student Name */}
//             <div className="mb-6">
//               <label className="block text-gray-700 font-medium mb-2 sm:text-left">
//                 Student Name*
//               </label>
//               <input
//                 type="text"
//                 id="name"
//                 name="name"
//                 onChange={handleChange}
//                 value={formData.name}
//                 placeholder="Enter full name of student"
//                 className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-500"
//               />
//               {warning.name && <WarningMsg message="This field is required" />}
//             </div>

//             {/* Select Gender */}
//             <div className="mb-6">
//               <label className="block text-gray-700 font-medium mb-2 sm:text-left">
//                 Select Gender*
//               </label>
//               <div className="flex flex-col sm:flex-row gap-4">
//                 <label className="flex items-center">
//                   <input
//                     type="radio"
//                     id="male"
//                     name="gender"
//                     value="Male"
//                     checked={formData.gender === "Male"}
//                     onChange={handleChange}
//                     className="mr-2 focus:ring-orange-500"
//                   />
//                   Male
//                 </label>
//                 <label className="flex items-center">
//                   <input
//                     type="radio"
//                     id="female"
//                     name="gender"
//                     value="Female"
//                     checked={formData.gender === "Female"}
//                     onChange={handleChange}
//                     className="mr-2 focus:ring-orange-500"
//                   />
//                   Female
//                 </label>
//                 <label className="flex items-center">
//                   <input
//                     type="radio"
//                     id="other"
//                     name="gender"
//                     value="Other"
//                     checked={formData.gender === "Other"}
//                     onChange={handleChange}
//                     className="mr-2 focus:ring-orange-500"
//                   />
//                   I don&apos;t want to tell
//                 </label>
//               </div>
//               {warning.gender && (
//                 <WarningMsg message="This field is required" />
//               )}
//             </div>

//             {/* Choose Your Category */}
//             <div className="mb-6">
//               <label className="block text-gray-700 font-medium mb-2 sm:text-left">
//                 Choose Your Category*
//               </label>
//               <Select
//                 options={categoryOptions}
//                 onChange={handleCategoryChange}
//                 placeholder="Select a category"
//                 styles={{
//                   control: (base) => ({
//                     ...base,
//                     borderColor: "gray",
//                     boxShadow: "none",
//                     "&:hover": { borderColor: "orange" },
//                   }),
//                   menu: (base) => ({
//                     ...base,
//                     zIndex: 10,
//                   }),
//                 }}
//               />
//               {warning.category && (
//                 <WarningMsg message="This field is required" />
//               )}
//             </div>

//             {/* Referral Code */}
//             <div className="mb-6">
//               <label className="block text-gray-700 font-medium mb-2 sm:text-left">
//                 Referral Code
//               </label>
//               <div className="flex gap-2">
//                 <input
//                   type="text"
//                   id="referralCode"
//                   name="referralCode"
//                   value={refCode}
//                   readOnly={isReadOnly}
//                   onChange={(e) => {
//                     setRefCode(e.target.value);
//                     setIsValid(false);
//                     setIsReadOnly(false);
//                     setShowValidation(false);
//                   }}
//                   placeholder="Enter referral code if you have"
//                   className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-500"
//                 />
//                 <button
//                   type="button"
//                   aria-label="Check Referral Code"
//                   onClick={() => validateReferral(refCode)}
//                   className="bg-orange-500 text-white px-3 py-2 rounded"
//                 >
//                   Check
//                 </button>
//               </div>
//               {showValidation && isValid && (
//                 <p className="text-green-600 text-[14px] mt-2">
//                   ✅ Valid Code! You get 10% off 🎉
//                 </p>
//               )}
//               {showValidation && !isValid && (
//                 <p className="text-red-600 text-[14px] mt-2">
//                   ❌ Invalid code. Please try another.
//                 </p>
//               )}
//             </div>

//             {/* How Did You Hear About Us */}
//             <div className="mb-8">
//               <label className="block text-gray-700 font-medium mb-2 sm:text-left">
//                 How Did You Hear About Us?
//               </label>
//               <select
//                 name="medium"
//                 onChange={handleChange}
//                 value={formData.medium}
//                 className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-500"
//               >
//                 <option>Please select one</option>
//                 <option value={"Facebook"}>Facebook</option>
//                 <option value={"Instagram"}>Instagram</option>
//                 <option value={"Google Search"}>Google Search</option>
//                 <option value={"Email"}>From Email</option>
//                 <option value={"Friends"}>Friends</option>
//               </select>
//             </div>

//             <div className="flex w-full justify-between flex-wrap gap-2">
//               {/* Next Button */}
//               <div
//                 className={`flex w-full justify-end sm:text-right text-center ml-auto`}
//               >
//                 <button
//                   type="button"
//                   aria-label="Next"
//                   onClick={sendOtp} //() => {chnageStep(step + 1);}
//                   className="w-full md:w-fit bg-orange-500 text-white font-medium px-10 py-2 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
//                 >
//                   Next
//                 </button>
//               </div>
//             </div>
//             <div id="sign-in-button" className="ml-20 mt-5"></div>
//             {loading && (
//               <div className="fixed inset-0 flex items-center justify-center bg-black/50">
//                 <div className="p-4 bg-white rounded shadow">
//                   Verifying… please wait
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* OTP Verification */}
//           {/* <div
//             className={`${
//               step === 1.5
//                 ? "w-full h-fit"
//                 : "w-0 opacity-0 h-20 overflow-hidden"
//             } transition-all duration-300`}
//           >
//             <p className="mb-2 text-center">Enter the 6-digit OTP</p>
//             <div className="flex justify-center space-x-2">
//               {otp.map((digit, idx) => (
//                 <input
//                   key={idx}
//                   ref={(el) => {
//                     inputsRef.current[idx] = el;
//                   }}
//                   type="text"
//                   inputMode="numeric"
//                   maxLength={1}
//                   value={digit}
//                   onChange={(e) => handleOtpChange(e, idx)}
//                   className="w-10 h-12 text-center border rounded focus:outline-none"
//                 />
//               ))}
//             </div>
//             <div className="mt-4 flex justify-center">
//               <button
//                 onClick={verifyOtp}
//                 className="w-full md:w-fit bg-orange-500 text-white font-medium px-10 py-2 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
//               >
//                 Verify
//               </button>
//             </div>
//           </div> */}
//           <div
//             className={`${
//               step === 1.5
//                 ? "w-full h-fit"
//                 : "w-0 opacity-0 h-20 overflow-hidden"
//             } transition-all duration-300`}
//           >
//             <p className="mb-1 text-center font-bold">Enter the 6-digit OTP</p>
//             <p className="text-xs text-center mb-1">
//               OTP has been sent to your mobile number {getPhoneNo()}
//             </p>
//             <p className="text-xs text-center mb-4">(Valid only for 5 min)</p>

//             {/* Show warning if wrong OTP */}
//             {otpData.wrongOtp && (
//               <p className="text-red-500 text-sm text-center mb-2">
//                 Incorrect OTP. Please try again.
//               </p>
//             )}

//             <div className="flex justify-center space-x-2">
//               {otp.map((digit, idx) => (
//                 <input
//                   key={idx}
//                   ref={(el) => {
//                     inputsRef.current[idx] = el;
//                   }}
//                   type="text"
//                   inputMode="numeric"
//                   maxLength={1}
//                   value={digit}
//                   onChange={(e) => handleOtpChange(e, idx)}
//                   onKeyDown={(e) => handleKeyDown(e, idx)}
//                   onPaste={handleOtpPaste}
//                   className="w-10 h-12 text-center border rounded focus:outline-none"
//                 />
//               ))}
//             </div>

//             <div className="mt-4 flex justify-center">
//               <button
//                 type="button"
//                 onClick={verifyOtp}
//                 className="w-full md:w-fit bg-orange-500 text-white font-medium px-10 py-2 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
//               >
//                 Verify
//               </button>
//             </div>

//             {/* Resend OTP section */}
//             <p className="mt-4 text-sm text-center">
//               Did not receive OTP?{" "}
//               {canResend ? (
//                 <span
//                   className="text-blue-500 underline cursor-pointer"
//                   onClick={sendOtp}
//                 >
//                   Resend OTP
//                 </span>
//               ) : (
//                 <span className="text-gray-500">Resend OTP in {timer}s</span>
//               )}
//             </p>
//           </div>

//           {/* STEP - 2  */}
//           <div
//             className={`${
//               step === 2 ? "w-full h-fit" : "w-0 opacity-0 h-20 overflow-hidden"
//             } transition-all duration-300`}
//           >
//             <h1
//               className="text-[30px]  md:text-[36px] text-center  text-[#210638] mb-4"
//               style={{ fontWeight: 500 }}
//             >
//               What would be an ideal time?
//             </h1>
//             <p className="text-center text-gray-600 mb-8">
//               Choose a date and time that suits you best.
//             </p>
//             {/* date  */}
//             <div className="mb-6">
//               <label className="block text-gray-700 font-medium mb-2 sm:text-left">
//                 Choose a Date*
//               </label>
//               <input
//                 type="date"
//                 id="prefDate"
//                 name="prefDate"
//                 onChange={handleChange}
//                 value={formData.prefDate}
//                 className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-500"
//               />
//               {warning.prefDate && (
//                 <WarningMsg message="This field is required" />
//               )}
//             </div>
//             {/* time  */}
//             <div className="mb-6">
//               <label className="block text-gray-700 font-medium mb-2 sm:text-left">
//                 Choose a Time*
//               </label>
//               <input
//                 type="time"
//                 id="prefTime"
//                 onChange={handleChange}
//                 value={formData.prefTime}
//                 name="prefTime"
//                 className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-500"
//               />
//               {warning.prefTime && (
//                 <WarningMsg message="This field is required" />
//               )}
//             </div>

//             <div className="flex md:flex-row flex-col w-full justify-between flex-wrap gap-4">
//               {/* Previous Button */}
//               {/* <div className="sm:text-left text-center">
//                 <button
//                   type="button"
//                   aria-label="Previous"
//                   onClick={() => chnageStep(step - 1)}
//                   className="w-full sm:w-fit bg-gray-300 text-gray-800 font-medium px-10 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
//                 >
//                   Previous
//                 </button>
//               </div> */}

//               {/* Next Button */}
//               <div className={`sm:text-right text-center`}>
//                 <button
//                   type="button"
//                   aria-label="Next"
//                   onClick={() => {
//                     chnageStep(step + 1);
//                   }}
//                   className="w-full sm:w-fit bg-orange-500 text-white font-medium px-10 py-2 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
//                 >
//                   Next
//                 </button>
//               </div>
//             </div>
//           </div>

//           {/* STEP - 3  */}
//           <div
//             className={`${
//               step === 3 ? "w-full h-fit" : "w-0 opacity-0 h-20 overflow-hidden"
//             } transition-all duration-300`}
//           >
//             <h1
//               className="text-[30px]  md:text-[36px] text-center  text-[#210638] mb-4"
//               style={{ fontWeight: 500 }}
//             >
//               Contact Details
//             </h1>
//             <p className="text-center text-gray-600 mb-8">Enter your details</p>

//             {/* Age group */}
//             <div className="mb-8">
//               <label className="block text-gray-700 font-medium mb-2 sm:text-left">
//                 Student Age Group*
//               </label>
//               <select
//                 name="age"
//                 onChange={handleChange}
//                 value={formData.age}
//                 className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-500"
//               >
//                 <option>Please select one</option>
//                 <option value={"6-9"}>6-9 years</option>
//                 <option value={"10-12"}>10-12 years</option>
//                 <option value={"13-17"}>13-17 years</option>
//                 <option value={"18-30"}>18-30 years</option>
//                 <option value={"31-40"}>31-40 years</option>
//                 <option value={"41-50"}>41-50 years</option>
//                 <option value={"50+"}>50+ years</option>
//               </select>
//               {warning.age && <WarningMsg message="This field is required" />}
//             </div>

//             {/* email */}
//             <div className="mb-6">
//               <label className="block text-gray-700 font-medium mb-2 sm:text-left">
//                 Email*
//               </label>
//               <input
//                 type="email"
//                 id="email"
//                 name="email"
//                 onChange={handleChange}
//                 value={formData.email}
//                 placeholder="Enter your email"
//                 className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 hover:border-orange-500"
//               />
//               {warning.email && <WarningMsg message="This field is required" />}
//             </div>

//             {/* terms n conditions  */}
//             <div className="flex flex-col mb-6 cursor-pointer">
//               <div className="flex gap-4">
//                 <input
//                   type="checkbox"
//                   name="terms"
//                   id="terms"
//                   onChange={toggleTnC}
//                 />
//                 <label htmlFor="terms" className=" text-gray-700 font-medium">
//                   I&apos;ve read the{" "}
//                   <Link
//                     href="/policy/terms-conditions/"
//                     aria-label="Terms & Conditions"
//                     className="text-blue-600 underline"
//                   >
//                     Terms & Conditions
//                   </Link>
//                 </label>
//               </div>
//               {warning.tnc && <WarningMsg message="This field is required" />}
//             </div>

//             <div className="flex flex-col md:flex-row w-full justify-between flex-wrap gap-4">
//               {/* Previous Button */}
//               <div className="sm:text-left text-center">
//                 <button
//                   type="button"
//                   aria-label="Previous"
//                   onClick={() => chnageStep(step - 1)}
//                   className="w-full sm:w-fit bg-gray-300 text-gray-800 font-medium px-10 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
//                 >
//                   Previous
//                 </button>
//               </div>

//               {/* Submit Button */}
//               <div className={`sm:text-right text-center`}>
//                 <button
//                   type="submit"
//                   aria-label="Submit"
//                   disabled={submitting}
//                   className="w-full sm:w-fit bg-orange-500 text-white font-medium px-10 py-2 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
//                 >
//                   {submitting ? "Submitting..." : "Submit"}
//                 </button>
//               </div>
//             </div>
//           </div>
//         </form>
//       </div>

//       <div className="mt-8">
//         <p
//           className="bg-[#FF9E00]  py-5  text-white text-[19px] md:text-[24px] text-center "
//           style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}
//         >
//           24/7 Dedicated Customer Support
//         </p>
//       </div>
//     </div>
//   );
// }

// function WarningMsg({ message }: { message: string }) {
//   return (
//     <div className="w-full text-red-900 text-xs rounded-lg bg-red-100 p-3 mt-2">
//       {message}
//     </div>
//   );
// }
