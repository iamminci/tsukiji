import {
  Stack,
  Select,
  Box,
  Button,
  SimpleGrid,
  HStack,
  NumberInputField,
  NumberInput,
  Flex,
  Spacer,
  Text,
  InputGroup,
} from "@chakra-ui/react";
import { MouseEventHandler } from "react";
import { useAccount } from "wagmi";
import { ConsiderationInput, OfferInput } from "./TokenInput";
import { OfferItem, ConsiderationItem } from "types/tokenTypes";

interface OrderPageProps {
  createSeaportOrder: MouseEventHandler;
  offerItems: OfferItem[];
  setOfferItems: (
    value: OfferItem[] | ((prevState: OfferItem[]) => OfferItem[])
  ) => void;
  considerationItems: ConsiderationItem[];
  setConsiderationItems: (
    value:
      | ConsiderationItem[]
      | ((prevState: ConsiderationItem[]) => ConsiderationItem[])
  ) => void;
}

export const OrderPage = ({
  createSeaportOrder,
  offerItems,
  setOfferItems,
  considerationItems,
  setConsiderationItems,
}: OrderPageProps) => {
  const { data: accountData } = useAccount();

  return (
    <>
      <Stack width={"80vw"} maxWidth="1000px" border={1} gap={4}>
        <SimpleGrid columns={[1, 2, 2]} spacing="40px">
          <Box>
            <OfferInput
              setItems={setOfferItems}
              items={offerItems}
              isOffer
            ></OfferInput>
          </Box>
          <Box>
            <ConsiderationInput
              setItems={setConsiderationItems}
              items={considerationItems}
            ></ConsiderationInput>
          </Box>
        </SimpleGrid>
        <Flex gap={4} alignContent="space-between">
          <HStack>
            <Box>
              <Text mb="6px" color={"gray"}>
                Duration
              </Text>
              <Select placeholder="Duration">
                <option value="24">1 day</option>
                <option value="72">3 days</option>
                <option value="168">7 days</option>
                <option value="720">1 month</option>
              </Select>
            </Box>
            <Box>
              <Text mb="6px" color={"gray"}>
                Tip
              </Text>
              <InputGroup>
                <NumberInput step={5} defaultValue={0.05} min={0}>
                  <NumberInputField />
                </NumberInput>
              </InputGroup>
            </Box>
          </HStack>
          <Spacer />
          <Button
            colorScheme="blue"
            onClick={createSeaportOrder}
            // disabled={!accountData?.address || offerItems.length === 0}
          >
            Create Listing
          </Button>
        </Flex>
      </Stack>
    </>
  );
};