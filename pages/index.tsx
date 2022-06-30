import type { NextPage } from "next";
import styles from "../styles/Home.module.css";
import { useAccount } from "wagmi";
import { NavBar } from "../components/NavBar";
import { Listings } from "../components/Listings";

const Home: NextPage = () => {
  const { data: accountData } = useAccount();

  return (
    <div className={styles.container}>
      <NavBar />
      <main className={styles.main}>
        <Listings address={accountData?.address} />
      </main>
    </div>
  );
};

export default Home;
